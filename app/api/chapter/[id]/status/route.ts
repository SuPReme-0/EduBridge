// app/api/chapter/[id]/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Verify ownership
    const curriculum = await prisma.curriculum.findFirst({
      where: {
        subjects: { some: { id: chapter.subjectId } },
        userId: user.id,
      },
    });
    
    if (!curriculum) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { currentVibe: true, currentStreak: true, learningTempo: true },
    });

    // ✅ COMPLETED - Return full chapter data
    if (chapter.status === 'COMPLETED') {
      return NextResponse.json({
        status: 'READY',
        chapter: {
          id: chapter.id,
          title: chapter.title,
          subject: { name: chapter.subject.name },
          mixedContent: chapter.mixedContent as any[] || [],
          status: 'READY',
          dynamicVibe: chapter.dynamicVibe,
          createdAt: chapter.createdAt.toISOString(),
          estimatedDuration: chapter.estimatedDuration || 30,
          userProgress: chapter.progress[0] ? {
            masteryLevel: chapter.progress[0].masteryLevel,
            timeSpentSeconds: chapter.progress[0].timeSpentSeconds,
            completedAt: chapter.progress[0].completedAt?.toISOString(),
            score: chapter.progress[0].score,
          } : null,
        },
        profile,
      });
    }

    // ✅ FAILED - Return error message
    if (chapter.status === 'FAILED') {
      return NextResponse.json({
        status: 'ERROR',
        error: chapter.errorMessage || 'Generation failed',
        profile,
      });
    }

    // ✅ GENERATING - Continue polling
    return NextResponse.json({
      status: chapter.status,  // 'GENERATING'
      profile,
    });
  } catch (error) {
    console.error('[Chapter Status] Error:', error);
    return NextResponse.json(
      { status: 'ERROR', error: 'Internal server error' },
      { status: 500 }
    );
  }
}