// app/api/chapter/[id]/route.ts
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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        subject: { select: { name: true } },
        progress: { where: { userId: user.id } },
      },
    });

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found.' }, { status: 404 });
    }

    // Verify ownership via curriculum
    const curriculum = await prisma.curriculum.findFirst({
      where: { 
        subjects: { some: { id: chapter.subjectId } },
        userId: user.id 
      },
    });

    if (!curriculum) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const userProgress = chapter.progress[0] || null;
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { currentVibe: true, currentStreak: true, learningTempo: true },
    });

    // ✅ SYNC: Return format matching lesson page expectations
    const duration = Date.now() - startTime;
    console.log(`[Chapter Fetch] Success in ${duration}ms | Chapter: ${id}`);

    return NextResponse.json({
      success: true,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        subject: { name: chapter.subject.name },
        // ✅ SYNC: mixedContent from orchestrator output (stored in DB as JSON)
        mixedContent: chapter.mixedContent as any[] || [],
        // ✅ SYNC: status field for generation state
        status: chapter.status as 'READY' | 'GENERATING' | 'ERROR' | 'COMPLETED',
        // ✅ SYNC: dynamicVibe for theme
        dynamicVibe: chapter.dynamicVibe || undefined,
        createdAt: chapter.createdAt.toISOString(),
        estimatedDuration: chapter.estimatedDuration || 30,
        // Include progress for UI
        userProgress: userProgress
          ? {
              masteryLevel: userProgress.masteryLevel,
              timeSpentSeconds: userProgress.timeSpentSeconds,
              completedAt: userProgress.completedAt?.toISOString(),
              score: userProgress.score,
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