import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const chapterId = resolvedParams.id;
    const { readingTime, score, masteryLevel } = await req.json();

    // Verify chapter belongs to user
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        subject: {
          include: {
            curriculum: { select: { userId: true } }
          }
        }
      }
    });

    if (!chapter || chapter.subject.curriculum.userId !== user.id) {
      return NextResponse.json({ error: 'Chapter not found or access denied.' }, { status: 404 });
    }

    // Update or create progress
    await prisma.progress.upsert({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: chapterId,
        }
      },
      update: {
        completedAt: new Date(),
        masteryLevel: masteryLevel || 100,
        score: score || null,
        timeSpentSeconds: { increment: readingTime || 0 },
        syncStatus: 'COMPLETED',
      },
      create: {
        userId: user.id,
        chapterId: chapterId,
        completedAt: new Date(),
        masteryLevel: masteryLevel || 100,
        score: score || null,
        timeSpentSeconds: readingTime || 0,
        syncStatus: 'COMPLETED',
      }
    });

    // Update chapter status to COMPLETED
    await prisma.chapter.update({
      where: { id: chapterId },
      data: { status: 'COMPLETED' }
    });

    // Update profile stats (FIXED: Removed chaptersCompleted - not in Prisma schema)
    const timeMinutes = Math.ceil((readingTime || 0) / 60);
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        totalStudyMinutes: { increment: timeMinutes },
        totalPoints: { increment: 50 },
        lastActiveAt: new Date(),
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[Chapter Complete] Success in ${duration}ms | Chapter: ${chapterId}`);

    return NextResponse.json({
      success: true,
      message: 'Chapter completed successfully.',
      pointsEarned: 50,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Chapter Complete] Error in ${duration}ms`, error);

    return NextResponse.json(
      { error: 'Failed to save reading progress.' },
      { status: 500 }
    );
  }
}