import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileRead, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Profile with Progress Data
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          include: {
            curriculums: {
              include: {
                subjects: {
                  include: {
                    chapters: {
                      include: {
                        progress: {
                          where: { userId: user.id },
                          select: {
                            completedAt: true,
                            masteryLevel: true,
                            score: true,
                            timeSpentSeconds: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Calculate Stats from Real Data
    const allChapters = profile.user.curriculums.flatMap((c) =>
      c.subjects.flatMap((s) => s.chapters)
    );

    const chaptersCompleted = allChapters.filter((ch) =>
      ch.progress.some((p) => p.completedAt !== null)
    ).length;

    const totalChapters = allChapters.length;

    // Calculate average mastery from progress
    const allProgress = allChapters.flatMap((ch) => ch.progress);
    const averageMastery =
      allProgress.length > 0
        ? Math.round(
            allProgress.reduce((acc, p) => acc + (p.masteryLevel || 0), 0) / allProgress.length
          )
        : 0;

    // Calculate total study time from progress + profile
    const timeFromProgress = Math.floor(
      allProgress.reduce((acc, p) => acc + (p.timeSpentSeconds || 0), 0) / 60
    );
    const totalTimeSpent = (profile.totalStudyMinutes || 0) + timeFromProgress;

    // Tests completed = chapters with scores
    const assessmentsTaken = allProgress.filter((p) => p.score !== null && p.score !== undefined).length;

    const duration = Date.now() - startTime;
    console.log(`[Stats Fetch] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json(
      {
        success: true,
        stats: {
          streak: profile.currentStreak || 0,
          totalPoints: profile.totalPoints || 0,
          chaptersCompleted,
          totalChapters,
          assessmentsTaken,
          averageMastery,
          totalTimeSpent,
          level: Math.floor((profile.totalPoints || 0) / 1000) + 1,
          longestStreak: profile.longestStreak || 0,
        },
      },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Stats Fetch] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to fetch statistics.' },
      { status: 500 }
    );
  }
}