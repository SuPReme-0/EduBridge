import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export const maxDuration = 60;

// Free-tier compatible model fallbacks
const VISION_MODELS = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'] as const;
const TEXT_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'] as const;

export async function POST(req: Request) {
  console.log("\n==========================================");
  console.log("🚀 [Doubts API] 1. INCOMING REQUEST RECEIVED");
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // 1. Authenticate
    console.log("🔐 [Doubts API] 1.1 Checking Auth...");
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log("❌ [Doubts API] Auth Failed. No user found.");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`✅ [Doubts API] 1.2 User Authenticated: ${user.id}`);

    // 2. Rate Limiting
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.doubts, user.id);

    if (!rateLimit.success) {
      console.log("❌ [Doubts API] Rate Limit Hit.");
      return new Response('AI rate limit exceeded. Please try again in a few minutes.', { status: 429 });
    }
    console.log("✅ [Doubts API] 2. Rate Limit Passed.");

    // 3. Parse Request - Use messages as-is from the client
    const payload = await req.json();
    console.log("✅ [Doubts API] 3. Payload Parsed. Keys:", Object.keys(payload));

    const messages = payload.messages;
    const chapterId = payload.data?.chapterId || payload.chapterId;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response('Invalid or empty messages.', { status: 400 });
    }

    // 4. Fetch Profile & Chapter Data (Parallel for speed)
    console.log("⏳ [Doubts API] 4. Fetching DB Context...");
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
    console.log("✅ [Doubts API] 4. DB Context Fetched.");

    // 5. Build Context
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

    // 6. Build System Prompt with warm‑hearted tone
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

    // 7. Determine if the last message contains an image (via experimental_attachments)
    const lastMessage = messages[messages.length - 1];
    const hasImage = !!(lastMessage?.experimental_attachments?.length > 0);

    // 8. Fallback Loop for Groq
    console.log(`🧠 [Doubts AI] 5. Routing to Groq. Has Image? ${hasImage}`);
    const modelList = hasImage ? VISION_MODELS : TEXT_MODELS;
    let result: any;
    let modelName: string = modelList[0];
    let lastError: any = null;

    for (const model of modelList) {
      try {
        console.log(`   -> Attempting Model: ${model}`);

        // Use maxOutputTokens for AI SDK v4
        result = await streamText({
          model: groq(model),
          system: systemPrompt,
          messages, // Pass original messages – the SDK handles attachments internally
          temperature: 0.5,
          maxOutputTokens: 1024, // v4 parameter
        });

        modelName = model;
        console.log(`   -> ✅ Model ${model} connected successfully!`);
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`   -> ❌ Model ${model} failed:`, err.message);
        continue;
      }
    }

    if (!result) {
      throw new Error(`All Groq models failed. Last error: ${lastError?.message}`);
    }

    // 9. Create Streaming Response – use toTextStreamResponse (v4)
    console.log("⚡ [Doubts AI] 6. Creating Stream Response...");
    const response = result.toTextStreamResponse();

    // Set optimized headers
    response.headers.set('X-Suggested-Topics', encodeURIComponent(JSON.stringify(suggestedTopics)));
    response.headers.set('X-Chapter-Title', encodeURIComponent(chapterTitle));
    response.headers.set('X-Subject', encodeURIComponent(currentSubject));
    response.headers.set('X-Chapter-Warning', chapterWarning.toString());
    response.headers.set('X-Chapter-Progress', chapterProgress.toString());
    response.headers.set('X-Chapter-Status', chapterStatus);
    response.headers.set('X-Request-ID', requestId);
    response.headers.set('X-Model-Used', modelName);
    response.headers.set('Access-Control-Allow-Origin', '*'); // Ensure CORS for all responses

    const duration = Date.now() - startTime;
    console.log(`🎉 [Doubts AI] 7. STREAMING STARTED in ${duration}ms using ${modelName}`);
    console.log("==========================================\n");

    return response;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Doubts API] FATAL ERROR | Duration: ${duration}ms`, error);
    console.log("==========================================\n");

    return new Response(
      "I experienced a brief neural glitch. Could you please ask that again?",
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}