import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { groq } from '@ai-sdk/groq';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier, recordTokenUsage } from '@/lib/rate-limit';
import crypto from 'crypto';
import { z } from 'zod';

export const maxDuration = 60; // Vercel timeout

const VISION_MODELS = ['llama-3.2-11b-vision-preview'] as const;
const TEXT_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'] as const;

// Simple sentiment analysis based on keywords
function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase();
  const positiveWords = ['happy', 'great', 'awesome', 'love', 'excited', 'good', 'fantastic', 'wonderful', 'amazing', 'thank'];
  const negativeWords = ['sad', 'bad', 'hate', 'terrible', 'awful', 'disappointed', 'frustrated', 'annoyed', 'stuck', 'confused', 'help', 'urgent'];

  let positiveCount = positiveWords.filter(w => lower.includes(w)).length;
  let negativeCount = negativeWords.filter(w => lower.includes(w)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function createLogger(requestId: string) {
  return {
    info: (message: string, data?: any) => console.log(`[${requestId}] [INFO] ${message}`, data ? JSON.stringify(data) : ''),
    warn: (message: string, data?: any) => console.warn(`[${requestId}] [WARN] ${message}`, data ? JSON.stringify(data) : ''),
    error: (message: string, error?: any) => console.error(`[${requestId}] [ERROR] ${message}`, error?.stack || error),
  };
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId);
  const startTime = Date.now();

  try {
    // --- CORS preflight (optional) ---
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

    // --- Rate Limiting ---
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.doubts, user.id);
    if (!rateLimit.success) {
      logger.warn('Rate limit exceeded', { userId: user.id, reset: rateLimit.reset });
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': rateLimit.reset.toString() } }
      );
    }

    // --- Parse Request ---
    const payload = await req.json();
    const { messages, chapterId, imageData } = payload;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error('Invalid messages payload', { messages });
      return NextResponse.json({ error: 'Invalid or empty messages.' }, { status: 400 });
    }

    // Get the latest user message for sentiment analysis
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
    const sentiment = analyzeSentiment(lastUserMessage);
    logger.info('Sentiment analysis', { sentiment, text: lastUserMessage.substring(0, 50) });

    // --- Fetch Profile & Chapter Data ---
    const [profile, targetChapter] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: { classLevel: true, currentVibe: true, fullName: true }
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

    // --- Build Context ---
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

    // --- Build System Prompt with Emotional Tone & Pedagogy ---
    const userName = profile?.fullName?.split(' ')[0] || 'there';
    const userGrade = profile?.classLevel ?? 'unknown';

    let emotionalDirective = '';
    if (sentiment === 'positive') {
      emotionalDirective = "The user seems happy or excited. Match their energy with enthusiasm and celebrate their curiosity!";
    } else if (sentiment === 'negative') {
      emotionalDirective = "The user seems frustrated or stuck. Be extra patient, validating, encouraging, and offer simple steps to help them feel unstuck.";
    } else {
      emotionalDirective = "Keep a warm, friendly, and encouraging tone throughout the conversation.";
    }

    // Notice we use standard quotes for the image tag to ensure it gets recognized as a trigger in the frontend, and we provide clear instructions in the system prompt about when and how to use it for optimal learning impact.
    const systemPrompt = `You are EduBridge's warm, empathetic AI Tutor – a life consultant and a friend to the student.
User's name: ${userName}
Grade Level: ${userGrade}
Subject: ${currentSubject}
Chapter: ${chapterTitle}
Progress: ${chapterProgress}%

CHAPTER CONTEXT (use this to anchor your response):
${contextText}

**Emotional guidance:** ${emotionalDirective}

**Interaction & Pedagogical guidelines (The Socratic Method):**
- Always start with a short, warm greeting or acknowledgment.
- Do NOT just give away the direct answer to homework problems. Guide the student to the answer. Provide hints, break down the problem into smaller steps, or ask a leading question.
- Answer the question clearly, using **bold** for key terms and important points.
- Be concise but thorough; avoid overly long paragraphs.
- End with a friendly, open-ended question or invitation to ask more.
- Never be robotic; use contractions and natural language.

**Visual Aids & Diagrams:**
Assess if the users would be able to understand the response better with the use of diagrams and trigger them. You can insert a diagram by adding the "" tag where X is a contextually relevant and domain-specific query to fetch the diagram. Examples of such tags include "

[Image of the human digestive system]
", "

[Image of hydrogen fuel cell]
" etc. Avoid triggering images just for visual appeal. For example, it is bad to trigger tags like "" for the prompt "what are day to day responsibilities of a software engineer" as such an image would not add any new informative value. Be economical but strategic in your use of image tags, only add multiple tags if each additional tag is adding instructive value beyond pure illustration. Optimize for completeness. Example for the query "stages of mitosis", its odd to leave out triggering tags for a few stages. Place the image tag immediately before or after the relevant text without disrupting the flow of the response.

${chapterWarning ? `Note: The student has only finished ${chapterProgress}% of this chapter. Gently encourage them to continue reading, but still answer their question helpfully.` : ''}`;

    // --- Prepare Messages for the Model ---
    const hasImage = !!imageData;
    const modelList = hasImage ? VISION_MODELS : TEXT_MODELS;
    logger.info(`Using models: ${modelList.join(', ')}`);

    // Convert frontend messages to Vercel AI SDK format
    const finalMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // If there's an image, attach it to the last user message (requires multi-modal format)
    if (hasImage) {
      const lastIndex = finalMessages.length - 1;
      finalMessages[lastIndex] = {
        role: 'user',
        content: [
          { type: 'text', text: finalMessages[lastIndex].content },
          { type: 'image', image: imageData }, // base64 data URL
        ],
      };
    }

    // --- Try models in order, fallback on failure ---
    let result: any = null;
    let modelUsed = '';
    let lastError: any = null;

    for (const model of modelList) {
      try {
        logger.info(`Attempting model: ${model}`);
        const { object, usage } = await generateObject({
          model: groq(model),
          system: systemPrompt,
          messages: finalMessages,
          schema: z.object({ answer: z.string() }),
          temperature: 0.7,
          // maxTokens removed to fix Type Error with older Vercel AI SDK versions
        });
        result = object.answer;
        modelUsed = model;
        if (usage?.totalTokens) await recordTokenUsage(user.id, usage.totalTokens);
        logger.info(`✅ Model ${model} succeeded`);
        break;
      } catch (err: any) {
        lastError = err;
        logger.warn(`❌ Model ${model} failed`, { error: err.message });
        continue;
      }
    }

    if (!result) {
      throw new Error(`All models failed. Last error: ${lastError?.message}`);
    }

    const duration = Date.now() - startTime;
    logger.info(`✅ Generation completed`, { durationMs: duration, modelUsed });

    return NextResponse.json({
      success: true,
      answer: result,
      modelUsed,
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