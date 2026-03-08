import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

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

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.assessment, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many assessment generations. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const authResult = await supabase.auth.getUser();
    const user = authResult.data?.user;
    const authError = authResult.error;

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { chapterId, chapterTitle, chapterContent, subject, questionCount = 5 } = body;

    let rawText = '';
    let chapterData = null;

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

      // Extract content from mixedContent (from lesson generation)
      if (chapterData.mixedContent) {
        const content = chapterData.mixedContent as any[];
        rawText = content
          .filter((b: any) => ['story', 'fact', 'definition'].includes(b.type))
          .map((b: any) => b.content || b.definitionData?.definition || '')
          .join('\n\n');
      }

      const classLevel = chapterData.subject.curriculum.user.profile?.classLevel || 10;
      const learningTempo = chapterData.subject.curriculum.user.profile?.learningTempo || 'NORMAL';

      // Adjust question count based on learning tempo
      const adjustedCount = learningTempo === 'EASY' ? Math.max(3, questionCount - 2)
        : learningTempo === 'EXTREME' ? Math.min(10, questionCount + 3)
        : questionCount;

      const { object: quizData } = await generateObject({
        model: google('gemini-2.5-flash'),
        system: `You are an expert assessment creator for ${subject}.
                 Generate exactly ${adjustedCount} engaging quiz questions based on the chapter content.

                 QUESTION TYPE DISTRIBUTION:
                 - 40% Single Choice MCQ
                 - 20% Multiple Choice MCQ
                 - 15% True/False
                 - 15% Short Answer
                 - 10% Long Answer

                 Every question MUST include:
                 - Clear prompt
                 - Appropriate options (for MCQ)
                 - Correct answer
                 - Detailed explanation
                 - Helpful hint
                 - Time limit (30s easy, 60s medium, 90s hard)
                 - Points (10 easy, 15 medium, 25 hard)

                 Difficulty should match Grade ${classLevel} level.
                 Questions should test understanding, not just memorization.`,
        prompt: `Generate a quiz based on this chapter titled "${chapterTitle || chapterData?.title}":\n\n${rawText.substring(0, 12000)}`,
        schema: z.object({
          questions: z.array(QuizQuestionSchema),
        }),
        temperature: 0.7
      });

      // Save assessment to Homework table
      await prisma.homework.upsert({
        where: { chapterId: chapterData.id },
        update: {
          tasks: quizData.questions,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        create: {
          chapterId: chapterData.id,
          tasks: quizData.questions,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }
      });

      const duration = Date.now() - startTime;
      console.log(`[Assessment Generate] Success in ${duration}ms | Chapter: ${chapterId}`);

      return NextResponse.json({
        success: true,
        questions: quizData.questions,
        questionCount: quizData.questions.length,
      });

    } else {
      // Fallback without chapterId
      const { object: quizData } = await generateObject({
        model: google('gemini-2.5-flash'),
        system: `You are an expert assessment creator for ${subject}.
                 Generate exactly ${questionCount} engaging quiz questions.
                 Include variety: MCQ, True/False, Short Answer, Long Answer.
                 Every question MUST include hint, explanation, time limit, and points.`,
        prompt: `Generate a quiz based on this content titled "${chapterTitle}":\n\n${JSON.stringify(chapterContent).substring(0, 12000)}`,
        schema: z.object({
          questions: z.array(QuizQuestionSchema),
        }),
        temperature: 0.7
      });

      const duration = Date.now() - startTime;
      console.log(`[Assessment Generate] Success in ${duration}ms`);

      return NextResponse.json({
        success: true,
        questions: quizData.questions,
        questionCount: quizData.questions.length,
      });
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Assessment Generate] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to generate assessment matrix.', details: error.message },
      { status: 500 }
    );
  }
}