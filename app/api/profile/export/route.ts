import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting (Stricter for exports)
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.export, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { 
          error: 'Export limit reached. You can export again in 1 hour.',
          retryAfter: rateLimit.reset
        }, 
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch All User Data
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
                        },
                        homework: true,
                        doubtSessions: {
                          where: { userId: user.id },
                        },
                      },
                    },
                  },
                },
              },
            },
            sessions: {
              orderBy: { startTime: 'desc' },
              take: 100,
            },
            auditLogs: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        },
        achievements: true,
        feedbacks: true,
      },
    });

    // Prepare Export Data (GDPR-compliant)
    const exportData = {
      exportId: crypto.randomUUID(),
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        role: profile?.user.role,
      },
      profile: {
        fullName: profile?.fullName,
        age: profile?.age,
        gender: profile?.gender,
        school: profile?.school,
        educationPath: profile?.educationPath,
        classLevel: profile?.classLevel,
        board: profile?.board,
        interests: profile?.interests,
        hobbies: profile?.hobbies,
        learningTempo: profile?.learningTempo,
        currentVibe: profile?.currentVibe,
        currentStreak: profile?.currentStreak,
        longestStreak: profile?.longestStreak,
        totalPoints: profile?.totalPoints,
        totalStudyMinutes: profile?.totalStudyMinutes,
        testsCompleted: profile?.testsCompleted,
        averageMastery: profile?.averageMastery,
      },
      curriculums: profile?.user.curriculums.map(c => ({
        id: c.id,
        title: c.title,
        status: c.status,
        createdAt: c.createdAt,
        subjectsCount: c.subjects.length,
        subjects: c.subjects.map(s => ({
          name: s.name,
          chaptersCount: s.chapters.length,
        })),
      })),
      achievements: profile?.achievements.map(a => ({
        name: a.name,
        unlocked: a.unlocked,
        unlockedAt: a.unlockedAt,
        category: a.category,
      })),
      studySessions: profile?.user.sessions.length,
      exportVersion: '1.0',
    };

    const duration = Date.now() - startTime;
    console.log(`[Export] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      data: exportData,
      message: 'Data exported successfully.',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Export] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to export data.' }, 
      { status: 500 }
    );
  }
}