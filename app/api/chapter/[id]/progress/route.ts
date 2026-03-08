import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const supabase = await createServerSupabaseClient();
    const authResult = await supabase.auth.getUser();
    const user = authResult.data?.user;
    const authError = authResult.error;

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const chapterId = resolvedParams.id;
    const { readingTime, completedBlocks, currentBlockIndex } = await req.json();

    // Verify chapter belongs to user
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

    // Update or create progress
    await prisma.progress.upsert({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: chapterId,
        },
      },
      update: {
        timeSpentSeconds: { increment: readingTime || 0 },
        updatedAt: new Date(),
        syncStatus: 'SYNCING',
      },
      create: {
        userId: user.id,
        chapterId: chapterId,
        timeSpentSeconds: readingTime || 0,
        syncStatus: 'SYNCING',
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[Chapter Progress] Saved in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      message: 'Progress saved successfully.',
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Chapter Progress] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to save progress.' },
      { status: 500 }
    );
  }
}