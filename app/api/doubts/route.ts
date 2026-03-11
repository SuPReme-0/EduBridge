// app/api/doubts/route.ts
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier, recordTokenUsage } from '@/lib/rate-limit';
import crypto from 'crypto';

export const maxDuration = 60; // Vercel timeout

const VISION_MODELS = ['llama-3.2-11b-vision-preview'] as const;
const TEXT_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'] as const;

function createLogger(requestId: string) {
  return {
    info: (message: string, data?: any) => {
      console.log(`[${requestId}] [INFO] ${message}`, data ? JSON.stringify(data) : '');
    },
    warn: (message: string, data?: any) => {
      console.warn(`[${requestId}] [WARN] ${message}`, data ? JSON.stringify(data) : '');
    },
    error: (message: string, error?: any) => {
      console.error(`[${requestId}] [ERROR] ${message}`, error?.stack || error);
    },
  };
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId);
  const startTime = Date.now();

  logger.info('🚀 Doubts API request started', { method: req.method });

  try {
    // --- CORS preflight (keep for safety) ---
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // --- Authentication ---
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error('Authentication failed', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.info('User authenticated', { userId: user.id });

    // --- Rate Limiting ---
    const rateLimit = await checkRateLimit(rateLimiters.doubts, user.id);
    if (!rateLimit.success) {
      logger.warn('Rate limit exceeded', { userId: user.id, reset: rateLimit.reset });
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': rateLimit.reset.toString() } }
      );
    }
    logger.info('Rate limit passed');

    // --- Parse Request ---
    const payload = await req.json();
    const { messages, chapterId, imageData } = payload; // imageData expected as base64 string

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error('Invalid messages payload', { messages });
      return NextResponse.json({ error: 'Invalid or empty messages.' }, { status: 400 });
    }
    logger.info('Payload parsed', { messageCount: messages.length, chapterId, hasImage: !!imageData });

    // --- Fetch Profile & Chapter Data ---
    logger.info('Fetching profile and chapter data from DB');
    const [profile, targetChapter] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: { classLevel: true, currentVibe: true }
      }),
      chapterId
        ? prisma.chapter.findUnique({
            where: { id: chapterId },
            include: {
              subject: { select: { name: true } },
              progress: { where: { userId: user.id } }
            },
          })
        : prisma.chapter.findFirst({
            where: { subject: { curriculum: { userId: user.id } } },
            orderBy: { updatedAt: 'desc' },
            include: {
              subject: { select: { name: true } },
              progress: { where: { userId: user.id } }
            },
          })
    ]);

    // --- Build Context (same as before) ---
    let contextText = "No specific chapter context available.";
    let currentSubject = "General Studies";
    let chapterTitle = "General Chat";
    let suggestedTopics: string[] = [];
    let chapterWarning = false;
    let chapterProgress = 0;
    let chapterStatus = 'NOT_STARTED';

    if (targetChapter) {
      currentSubject = targetChapter.subject.name;
      chapterTitle = targetChapter.title;
      chapterStatus = targetChapter.status;

      const userProgress = targetChapter.progress[0];
      if (userProgress) {
        chapterProgress = Math.round(userProgress.masteryLevel || 0);
        if (userProgress.completedAt) {
          chapterStatus = 'COMPLETED';
        } else if (userProgress.timeSpentSeconds > 0) {
          chapterStatus = 'IN_PROGRESS';
        }
      }

      if (chapterStatus !== 'COMPLETED' && chapterProgress < 80) {
        chapterWarning = true;
      }

      if (targetChapter.mixedContent && Array.isArray(targetChapter.mixedContent)) {
        const blocks = targetChapter.mixedContent as any[];
        const relevantBlocks = blocks.filter((b) =>
          ['story', 'fact', 'definition', 'quiz', 'code'].includes(b.type)
        );

        contextText = relevantBlocks
          .map((b) => {
            if (b.type === 'definition') return `📚 ${b.definitionData?.term}: ${b.definitionData?.definition}`;
            if (b.type === 'quiz') return `❓ Q: ${b.quizData?.prompt}\n✅ A: ${b.quizData?.correctAnswer}`;
            if (b.type === 'code') return `💻 Code Example:\n${b.codeData?.code}`;
            return b.content || '';
          })
          .filter(Boolean)
          .join('\n\n')
          .substring(0, 8000);

        const definitions = relevantBlocks.filter((b) => b.type === 'definition').slice(0, 3).map((b) => `Explain ${b.definitionData?.term}`);
        const examples = relevantBlocks.filter((b) => b.type === 'fact' || b.type === 'story').slice(0, 2).map(() => 'Give me a real-world example');
        suggestedTopics = [...new Set([...definitions, ...examples])].slice(0, 5);
      }
    }
    logger.info('Context built', { subject: currentSubject, chapter: chapterTitle, topicsCount: suggestedTopics.length });

    // --- Build System Prompt ---
    const userGrade = profile?.classLevel ?? 'unknown';
    const vibe = profile?.currentVibe || 'standard';

    const systemPrompt = `You are EduBridge's warm and encouraging AI Tutor.
Grade Level: ${userGrade}.
Subject: ${currentSubject}.
Chapter: ${chapterTitle}.
Progress: ${chapterProgress}%.

CHAPTER CONTEXT:
${contextText}

GUIDELINES:
- Be friendly, supportive, and celebrate small wins.
- Match complexity to grade level ${userGrade}.
- Be concise. Start with a direct answer. Use **bold** for key terms.
- If a visual diagram helps, use exactly: [Image of X]. Example: [Image of mitochondria cell structure].
${chapterWarning ? `- The student has only finished ${chapterProgress}% of this chapter. End your response with a brief, friendly tip to keep reading the chapter for more context.` : ''}`;

    // --- Determine Model ---
    const hasImage = !!imageData;
    const modelList = hasImage ? VISION_MODELS : TEXT_MODELS;
    logger.info(`Routing to Groq. Has image? ${hasImage}`, { models: modelList });

    let result: Awaited<ReturnType<typeof generateText>> | null = null;
    let modelName: string = modelList[0];
    let lastError: any = null;

    for (const model of modelList) {
      try {
        logger.info(`Attempting model: ${model}`);
        // For image messages, we need to pass the image as a user message part.
        // Since we're using generateText, we can construct the messages array with image content if needed.
        const finalMessages = [...messages];
        if (hasImage) {
          // Replace the last user message with one that includes the image.
          // The SDK supports `experimental_attachments`, but for generateText we can use a content array.
          // We'll keep it simple: add the image URL to the message text.
          // Alternatively, we could use the multi-modal format, but for now we'll assume the image is already in the last message content as a URL.
          // Actually, the frontend sends imageData separately. We'll append it as a user message.
          finalMessages.push({
            role: 'user',
            content: [
              { type: 'text', text: messages[messages.length - 1]?.content || 'Please analyze this image.' },
              { type: 'image_url', image_url: { url: imageData } }
            ]
          });
        }

        result = await generateText({
          model: groq(model),
          system: systemPrompt,
          messages: finalMessages,
          temperature: 0.5,
          maxOutputTokens: 1024,
        });
        modelName = model;
        logger.info(`✅ Model ${model} succeeded`);
        break;
      } catch (err: any) {
        lastError = err;
        logger.warn(`❌ Model ${model} failed`, { error: err.message });
        continue;
      }
    }

    if (!result) {
      throw new Error(`All Groq models failed. Last error: ${lastError?.message}`);
    }

    // --- Track token usage ---
    if (result.usage?.totalTokens) {
      await recordTokenUsage(user.id, result.usage.totalTokens);
    }

    const duration = Date.now() - startTime;
    logger.info(`✅ Generation completed`, { durationMs: duration, modelUsed: modelName });

    // --- Return JSON response with answer and metadata ---
    return NextResponse.json({
      success: true,
      answer: result.text,
      modelUsed: modelName,
      chapterInfo: {
        title: chapterTitle,
        subject: currentSubject,
        progress: chapterProgress,
        status: chapterStatus,
        warning: chapterWarning,
      },
      suggestedTopics,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Fatal error', error);

    return NextResponse.json(
      { error: 'Failed to process your question.', details: error.message },
      { status: 500 }
    );
  }
}