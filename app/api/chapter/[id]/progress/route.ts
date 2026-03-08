// app/api/chapter/[id]/progress/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const supabase = await createServerSupabaseClient();
    const authResult = await supabase.auth.getUser();
    const user = authResult.data?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const chapterId = resolvedParams.id;
    const { readingTime, completedBlocks, currentBlockIndex } = await req.json();

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

    // Update progress
    await prisma.progress.upsert({
      where: {
        userId_chapterId: { userId: user.id, chapterId },
      },
      update: {
        timeSpentSeconds: { increment: readingTime || 0 },
        currentBlockIndex: currentBlockIndex ?? undefined,
        completedBlockIds: completedBlocks?.length 
          ? { set: completedBlocks } 
          : undefined,
        updatedAt: new Date(),
        syncStatus: 'SYNCING',
      },
      create: {
        userId: user.id,
        chapterId,
        timeSpentSeconds: readingTime || 0,
        currentBlockIndex: currentBlockIndex ?? 0,
        completedBlockIds: completedBlocks || [],
        syncStatus: 'SYNCING',
      },
    });

    return NextResponse.json({ success: true, message: 'Progress saved.' });
  } catch (error: any) {
    console.error('[Chapter Progress] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save progress.' },
      { status: 500 }
    );
  }
}