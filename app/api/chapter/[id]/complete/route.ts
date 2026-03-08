// app/api/chapter/[id]/complete/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const authResult = await supabase.auth.getUser();
    const user = authResult.data?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const chapterId = resolvedParams.id;
    const { readingTime, score, masteryLevel, completedBlocks, quizResults } = await req.json();

    // Verify ownership
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        subject: {
          include: {
            curriculum: { select: { userId: true } },
          },
        },
      },
    });

    if (!chapter || chapter.subject.curriculum.userId !== user.id) {
      return NextResponse.json(
        { error: 'Chapter not found or access denied.' },
        { status: 404 }
      );
    }

    // Update progress to COMPLETED
    await prisma.progress.upsert({
      where: { userId_chapterId: { userId: user.id, chapterId } },
      update: {
        completedAt: new Date(),
        masteryLevel: masteryLevel ?? 100,
        score: score ?? null,
        timeSpentSeconds: { increment: readingTime || 0 },
        completedBlockIds: completedBlocks?.length ? { set: completedBlocks } : undefined,
        quizResults: quizResults ? { set: quizResults } : undefined,
        syncStatus: 'COMPLETED',
      },
      create: {
        userId: user.id,
        chapterId,
        completedAt: new Date(),
        masteryLevel: masteryLevel ?? 100,
        score: score ?? null,
        timeSpentSeconds: readingTime || 0,
        completedBlockIds: completedBlocks || [],
        quizResults: quizResults || [],
        syncStatus: 'COMPLETED',
      },
    });

    // Update chapter status
    await prisma.chapter.update({
      where: { id: chapterId },
      data: { status: 'COMPLETED' },
    });

    // Update profile stats
    const timeMinutes = Math.ceil((readingTime || 0) / 60);
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        totalStudyMinutes: { increment: timeMinutes },
        totalPoints: { increment: 50 },
        lastActiveAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Chapter completed successfully.',
      pointsEarned: 50,
    });
  } catch (error: any) {
    console.error('[Chapter Complete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save completion.' },
      { status: 500 }
    );
  }
}