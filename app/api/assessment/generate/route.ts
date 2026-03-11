import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier, recordTokenUsage } from '@/lib/rate-limit';
import crypto from 'crypto';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// ============================================================================
// 1. HELPER: SMART EXPONENTIAL BACKOFF WITH ERROR FILTERING
// ============================================================================
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 2000
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      
      const isValidationError =
        error.name === 'TypeValidationError' ||
        error.name === 'ZodError' ||
        error?.statusCode === 400;

      if (isValidationError) {
        console.error('[Assessment] Fatal Schema Error.', error);
        throw error;
      }

      const isRetryable =
        error?.statusCode === 429 ||
        (error?.statusCode && error.statusCode >= 500) ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET';

      if (!isRetryable || attempt === retries) {
        throw error;
      }

      const waitMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000, 60000);
      console.warn(`[Assessment Retry] Attempt ${attempt}/${retries}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error('Unreachable');
}

// ============================================================================
// 2. TIMEOUT WRAPPER
// ============================================================================
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    )
  ]);
}

// ============================================================================
// 3. SCHEMAS (same as before, but ensure they match your design)
// ============================================================================
const BaseQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['single_mcq', 'multiple_mcq', 'true_false', 'short_answer', 'long_answer', 'image_mcq']),
  prompt: z.string(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  points: z.number(),
  hint: z.string(),
  timeLimit: z.number(),
});

const MCQQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('single_mcq'),
  options: z.array(z.string()).min(2).max(6),
});

const MultipleMCQSchema = BaseQuestionSchema.extend({
  type: z.literal('multiple_mcq'),
  options: z.array(z.string()).min(3).max(8),
  correctAnswer: z.array(z.string()),
});

const TrueFalseSchema = BaseQuestionSchema.extend({
  type: z.literal('true_false'),
  options: z.array(z.literal('True').or(z.literal('False'))),
});

const ShortAnswerSchema = BaseQuestionSchema.extend({
  type: z.literal('short_answer'),
  correctAnswer: z.string(),
  keywords: z.array(z.string()),
});

const LongAnswerSchema = BaseQuestionSchema.extend({
  type: z.literal('long_answer'),
  correctAnswer: z.string(),
  rubric: z.object({
    points: z.number(),
    criteria: z.array(z.string()),
  }),
});

const ImageMCQSchema = BaseQuestionSchema.extend({
  type: z.literal('image_mcq'),
  imageUrl: z.string(),
  options: z.array(z.string()).min(2).max(6),
  imageDescription: z.string(),
});

const QuizQuestionSchema = z.union([
  MCQQuestionSchema,
  MultipleMCQSchema,
  TrueFalseSchema,
  ShortAnswerSchema,
  LongAnswerSchema,
  ImageMCQSchema,
]);

// ============================================================================
// 4. MAIN HANDLER
// ============================================================================
export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // --- Rate limiting ---
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.assessment, clientIp);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many assessment generations. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': rateLimit.reset.toString() } }
      );
    }

    // --- Authentication ---
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Parse request ---
    const body = await req.json();
    const { chapterId, chapterTitle, chapterContent, subject, questionCount = 5, force = false } = body;

    // Must have either chapterId or chapterTitle+chapterContent
    if (!chapterId && !chapterTitle) {
      return NextResponse.json(
        { error: 'Either chapterId or chapterTitle + chapterContent required' },
        { status: 400 }
      );
    }

    let rawText = '';
    let chapterData = null;
    let classLevel = 10;
    let learningTempo = 'NORMAL';

    // --- If chapterId provided, fetch chapter and validate ownership ---
    if (chapterId) {
      chapterData = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: {
          subject: {
            include: {
              curriculum: {
                include: {
                  user: {
                    include: {
                      profile: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!chapterData) {
        return NextResponse.json({ error: 'Chapter not found.' }, { status: 404 });
      }

      if (chapterData.subject.curriculum.userId !== user.id) {
        return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
      }

      // Extract text from mixedContent
      if (chapterData.mixedContent) {
        const content = chapterData.mixedContent as any[];
        rawText = content
          .filter((b: any) => ['story', 'fact', 'definition'].includes(b.type))
          .map((b: any) => b.content || b.definitionData?.definition || '')
          .join('\n\n');
      }

      // Get user profile
      classLevel = chapterData.subject.curriculum.user.profile?.classLevel || 10;
      learningTempo = chapterData.subject.curriculum.user.profile?.learningTempo || 'NORMAL';

      // --- Cache check: return existing homework if not forced and not older than 7 days ---
      if (!force) {
        const existingHomework = await prisma.homework.findUnique({
          where: { chapterId: chapterData.id }
        });
        if (existingHomework && existingHomework.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
          console.log(`[Assessment] Using cached homework for chapter ${chapterId}`);
          return NextResponse.json({
            success: true,
            questions: existingHomework.tasks as any[],
            questionCount: (existingHomework.tasks as any[]).length,
            cached: true
          });
        }
      }
    } else {
      // Fallback: use provided content and default profile
      rawText = JSON.stringify(chapterContent).substring(0, 30000);
    }

    // --- Adjust question count based on learning tempo ---
    let adjustedCount = questionCount;
    if (learningTempo === 'EASY') {
      adjustedCount = Math.max(3, questionCount - 2);
    } else if (learningTempo === 'EXTREME') {
      adjustedCount = Math.min(10, questionCount + 3);
    }

    // --- Decide which model to use: 8B by default, 70B for complex subjects or if explicitly requested ---
    const use70B = body.use70B || (subject && ['physics', 'chemistry', 'advanced'].some(s => subject.toLowerCase().includes(s)));
    const modelName = use70B ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

    // --- Generate questions with retry and timeout ---
    const { object: quizData, usage } = await withRetry(async () => {
      return await withTimeout(
        generateObject({
          model: groq(modelName),
          providerOptions: {
            groq: {
              structuredOutputs: false,
              response_format: { type: 'json_object' },
            },
          },
          system: `You are an expert assessment creator for ${subject || 'general'}.
Generate exactly ${adjustedCount} engaging quiz questions based on the provided content.

QUESTION TYPE DISTRIBUTION (adhere to these percentages):
- 40% Single Choice MCQ
- 20% Multiple Choice MCQ
- 15% True/False
- 15% Short Answer
- 10% Long Answer
Optionally include image‑based MCQ if relevant.

Every question MUST include:
- Clear prompt
- Appropriate options (for MCQ types)
- Correct answer(s)
- Detailed explanation
- Helpful hint
- Time limit (30s easy, 60s medium, 90s hard)
- Points (10 easy, 15 medium, 25 hard)

Difficulty should match Grade ${classLevel} level.
Questions should test understanding, not just memorization.`,
          prompt: `Generate a quiz based on this chapter titled "${chapterTitle || chapterData?.title}":\n\n${rawText.substring(0, 30000)}`,
          schema: z.object({
            questions: z.array(QuizQuestionSchema),
          }),
          temperature: 0.5,
        }),
        60000 // 60 second timeout
      );
    }, 3, 2000);

    // --- Track token usage ---
    if (usage?.totalTokens) {
      await recordTokenUsage(user.id, usage.totalTokens);
    }

    // --- Save to database if chapterId exists ---
    if (chapterId) {
      await prisma.homework.upsert({
        where: { chapterId },
        update: {
          tasks: quizData.questions,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        create: {
          chapterId,
          tasks: quizData.questions,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Assessment] Success in ${duration}ms using ${modelName} | Questions: ${quizData.questions.length}`);

    return NextResponse.json({
      success: true,
      questions: quizData.questions,
      questionCount: quizData.questions.length,
      modelUsed: modelName,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Assessment] Error in ${duration}ms | Request: ${requestId}`, error);

    if (error.name === 'TypeValidationError' || error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'AI failed to generate a valid quiz. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate assessment matrix.', details: error.message },
      { status: 500 }
    );
  }
}