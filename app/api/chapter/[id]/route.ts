// app/api/chapter/[id]/route.ts – with Redis caching (chapter content only) and optimized progress fetch
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client using environment variables
const redis = Redis.fromEnv();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const supabase = await createServerSupabaseClient();
    const authResult = await supabase.auth.getUser();
    const user = authResult.data?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;

    // ---------- CACHING STRATEGY ----------
    // Cache key for chapter content (does NOT include progress)
    const cacheKey = `chapter:${id}:content`;
    let chapterData: {
      id: string;
      title: string;
      subjectName: string;
      mixedContent: any[];
      status: string;
      dynamicVibe?: string;
      createdAt: string;
      estimatedDuration: number;
      subjectId: string;
    } | null = null;

    // 1. Try to get chapter content from Redis
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        chapterData = JSON.parse(cached as string);
        console.log(`[Chapter Fetch] Cache hit for ${id}`);
      }
    } catch (redisError) {
      console.warn(`[Chapter Fetch] Redis error, falling back to DB:`, redisError);
    }

    // 2. If not in cache, fetch from DB
    if (!chapterData) {
      const dbChapter = await prisma.chapter.findUnique({
        where: { id },
        include: {
          subject: { select: { name: true } },
          // Do NOT include progress here – we'll fetch separately
        },
      });

      if (!dbChapter) {
        return NextResponse.json({ error: 'Chapter not found.' }, { status: 404 });
      }

      // Store data in serializable format
      chapterData = {
        id: dbChapter.id,
        title: dbChapter.title,
        subjectName: dbChapter.subject.name,
        mixedContent: (dbChapter.mixedContent as any[]) || [],
        status: dbChapter.status,
        dynamicVibe: dbChapter.dynamicVibe || undefined,
        createdAt: dbChapter.createdAt.toISOString(),
        estimatedDuration: dbChapter.estimatedDuration || 30,
        subjectId: dbChapter.subjectId,
      };

      // Only cache if chapter is COMPLETED (to avoid caching incomplete or failed chapters)
      if (dbChapter.status === 'COMPLETED') {
        try {
          // Cache for 1 hour (3600 seconds)
          await redis.setex(cacheKey, 3600, JSON.stringify(chapterData));
          console.log(`[Chapter Fetch] Cached ${id} for 1 hour`);
        } catch (redisError) {
          console.warn(`[Chapter Fetch] Failed to cache:`, redisError);
        }
      }
    }

    // 3. Verify ownership using the chapterData (which has subjectId)
    const curriculum = await prisma.curriculum.findFirst({
      where: {
        subjects: { some: { id: chapterData.subjectId } },
        userId: user.id,
      },
    });

    if (!curriculum) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // 4. Fetch user's progress for this chapter (user-specific, not cached)
    const progress = await prisma.progress.findUnique({
      where: {
        userId_chapterId: { userId: user.id, chapterId: id },
      },
      select: {
        masteryLevel: true,
        timeSpentSeconds: true,
        completedAt: true,
        score: true,
        currentBlockIndex: true,
        completedBlockIds: true,
        quizResults: true,
      },
    });

    // 5. Fetch profile data (user-specific, not cached)
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { currentVibe: true, currentStreak: true, learningTempo: true },
    });

    const duration = Date.now() - startTime;
    console.log(`[Chapter Fetch] Success in ${duration}ms | Chapter: ${id}`);

    // 6. Return combined response (with cache-control headers to allow browser caching for a short time)
    return NextResponse.json(
      {
        success: true,
        chapter: {
          id: chapterData.id,
          title: chapterData.title,
          subject: { name: chapterData.subjectName },
          mixedContent: chapterData.mixedContent,
          status: chapterData.status as 'READY' | 'GENERATING' | 'ERROR' | 'COMPLETED',
          dynamicVibe: chapterData.dynamicVibe,
          createdAt: chapterData.createdAt,
          estimatedDuration: chapterData.estimatedDuration,
          userProgress: progress
            ? {
                masteryLevel: progress.masteryLevel,
                timeSpentSeconds: progress.timeSpentSeconds,
                completedAt: progress.completedAt?.toISOString(),
                score: progress.score,
                currentBlockIndex: progress.currentBlockIndex,
                completedBlockIds: progress.completedBlockIds as string[],
                quizResults: progress.quizResults as any[],
              }
            : null,
        },
        profile: profile
          ? {
              currentVibe: profile.currentVibe,
              currentStreak: profile.currentStreak,
              learningTempo: profile.learningTempo,
            }
          : undefined,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60', // Allow browser to cache for 60 seconds (since content rarely changes, but user progress might update frequently)
        },
      }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Chapter Fetch] Error in ${duration}ms`, error);
    return NextResponse.json(
      { error: 'Failed to retrieve chapter data.' },
      { status: 500 }
    );
  }
}