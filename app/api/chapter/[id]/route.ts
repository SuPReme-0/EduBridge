import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
    const authError = authResult.error;

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        subject: {
          include: {
            curriculum: {
              select: { userId: true },
            },
          },
        },
        progress: {
          where: { userId: user.id },
        },
        homework: true,
      },
    });

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found.' }, { status: 404 });
    }

    if (chapter.subject.curriculum.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Get user's progress for this chapter
    const userProgress = chapter.progress[0] || null;

    // Get profile for theme
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        currentVibe: true,
        currentStreak: true,
        learningTempo: true,
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[Chapter Fetch] Success in ${duration}ms | Chapter: ${id}`);

    return NextResponse.json({
      success: true,
      chapter: {
        ...chapter,
        userProgress: userProgress
          ? {
              masteryLevel: userProgress.masteryLevel,
              timeSpentSeconds: userProgress.timeSpentSeconds,
              completedAt: userProgress.completedAt,
              score: userProgress.score,
            }
          : null,
      },
      profile,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Chapter Fetch] Error in ${duration}ms`, error);

    return NextResponse.json(
      { error: 'Failed to retrieve chapter data.' },
      { status: 500 }
    );
  }
}