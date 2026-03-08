import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile with all stats
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      include: {
        achievements: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get user's curriculums to check syllabus status
    const curriculums = await prisma.curriculum.findMany({
      where: { userId: user.id },
      include: {
        subjects: {
          include: {
            chapters: {
              include: {
                progress: {
                  where: { userId: user.id },
                },
              },
            },
          },
        },
      },
    });

    // Calculate real achievement progress
    const totalChaptersCompleted = curriculums.reduce((acc, curr) => {
      return acc + curr.subjects.reduce((subAcc, subject) => {
        return subAcc + subject.chapters.filter(
          ch => ch.progress.some(p => p.completedAt !== null)
        ).length;
      }, 0);
    }, 0);

    const totalChapters = curriculums.reduce((acc, curr) => {
      return acc + curr.subjects.reduce((subAcc, subject) => {
        return subAcc + subject.chapters.length;
      }, 0);
    }, 0);

    // Calculate subject mastery
    const subjectMastery: Record<string, { completed: number; total: number; percentage: number }> = {};
    curriculums.forEach(curr => {
      curr.subjects.forEach(subject => {
        const completed = subject.chapters.filter(
          ch => ch.progress.some(p => p.completedAt !== null)
        ).length;
        subjectMastery[subject.name] = {
          completed,
          total: subject.chapters.length,
          percentage: subject.chapters.length > 0 
            ? Math.round((completed / subject.chapters.length) * 100) 
            : 0,
        };
      });
    });

    // Build comprehensive achievements list
    const achievements = [
      // 📚 LEARNING ACHIEVEMENTS
      {
        id: 'learn_first_chapter',
        userId: user.id,
        name: 'First Steps',
        description: 'Complete your first chapter',
        unlocked: totalChaptersCompleted >= 1,
        unlockedAt: null,
        progress: Math.min(totalChaptersCompleted, 1),
        total: 1,
        category: 'learning',
      },
      {
        id: 'learn_10_chapters',
        userId: user.id,
        name: 'Knowledge Seeker',
        description: 'Complete 10 chapters',
        unlocked: totalChaptersCompleted >= 10,
        unlockedAt: null,
        progress: Math.min(totalChaptersCompleted, 10),
        total: 10,
        category: 'learning',
      },
      {
        id: 'learn_50_chapters',
        userId: user.id,
        name: 'Scholar',
        description: 'Complete 50 chapters',
        unlocked: totalChaptersCompleted >= 50,
        unlockedAt: null,
        progress: Math.min(totalChaptersCompleted, 50),
        total: 50,
        category: 'learning',
      },
      {
        id: 'learn_100_chapters',
        userId: user.id,
        name: 'Master Scholar',
        description: 'Complete 100 chapters',
        unlocked: totalChaptersCompleted >= 100,
        unlockedAt: null,
        progress: Math.min(totalChaptersCompleted, 100),
        total: 100,
        category: 'learning',
      },
      
      // 🔥 STREAK ACHIEVEMENTS
      {
        id: 'streak_3_days',
        userId: user.id,
        name: 'Getting Warm',
        description: 'Maintain a 3-day learning streak',
        unlocked: (profile.currentStreak || 0) >= 3,
        unlockedAt: null,
        progress: Math.min(profile.currentStreak || 0, 3),
        total: 3,
        category: 'streak',
      },
      {
        id: 'streak_7_days',
        userId: user.id,
        name: 'Week Warrior',
        description: 'Maintain a 7-day streak',
        unlocked: (profile.currentStreak || 0) >= 7,
        unlockedAt: null,
        progress: Math.min(profile.currentStreak || 0, 7),
        total: 7,
        category: 'streak',
      },
      {
        id: 'streak_30_days',
        userId: user.id,
        name: 'Monthly Master',
        description: 'Maintain a 30-day streak',
        unlocked: (profile.currentStreak || 0) >= 30,
        unlockedAt: null,
        progress: Math.min(profile.currentStreak || 0, 30),
        total: 30,
        category: 'streak',
      },
      {
        id: 'streak_100_days',
        userId: user.id,
        name: 'Century Club',
        description: 'Maintain a 100-day streak',
        unlocked: (profile.currentStreak || 0) >= 100,
        unlockedAt: null,
        progress: Math.min(profile.currentStreak || 0, 100),
        total: 100,
        category: 'streak',
      },

      // 🎯 MASTERY ACHIEVEMENTS
      {
        id: 'mastery_subject_100',
        userId: user.id,
        name: 'Subject Master',
        description: 'Achieve 100% mastery in any subject',
        unlocked: Object.values(subjectMastery).some(s => s.percentage >= 100),
        unlockedAt: null,
        progress: Object.values(subjectMastery).filter(s => s.percentage >= 100).length,
        total: 1,
        category: 'mastery',
      },
      {
        id: 'mastery_all_subjects',
        userId: user.id,
        name: 'Polymath',
        description: 'Achieve 100% mastery in all subjects',
        unlocked: Object.values(subjectMastery).length > 0 && 
                  Object.values(subjectMastery).every(s => s.percentage >= 100),
        unlockedAt: null,
        progress: Object.values(subjectMastery).filter(s => s.percentage >= 100).length,
        total: Object.values(subjectMastery).length || 1,
        category: 'mastery',
      },
      {
        id: 'mastery_avg_90',
        userId: user.id,
        name: 'Excellence',
        description: 'Maintain 90%+ average mastery',
        unlocked: (profile.averageMastery || 0) >= 90,
        unlockedAt: null,
        progress: Math.min(profile.averageMastery || 0, 90),
        total: 90,
        category: 'mastery',
      },

      // 📝 TEST ACHIEVEMENTS
      {
        id: 'test_first',
        userId: user.id,
        name: 'Test Taker',
        description: 'Complete your first assessment',
        unlocked: (profile.testsCompleted || 0) >= 1,
        unlockedAt: null,
        progress: Math.min(profile.testsCompleted || 0, 1),
        total: 1,
        category: 'learning',
      },
      {
        id: 'test_10',
        userId: user.id,
        name: 'Exam Veteran',
        description: 'Complete 10 assessments',
        unlocked: (profile.testsCompleted || 0) >= 10,
        unlockedAt: null,
        progress: Math.min(profile.testsCompleted || 0, 10),
        total: 10,
        category: 'learning',
      },
      {
        id: 'test_perfect',
        userId: user.id,
        name: 'Perfect Score',
        description: 'Get 100% on any assessment',
        unlocked: (profile.averageMastery || 0) >= 100,
        unlockedAt: null,
        progress: (profile.averageMastery || 0) >= 100 ? 1 : 0,
        total: 1,
        category: 'mastery',
      },

      // ⏱️ TIME ACHIEVEMENTS
      {
        id: 'time_1_hour',
        userId: user.id,
        name: 'Time Invested',
        description: 'Study for 1 hour total',
        unlocked: (profile.totalStudyMinutes || 0) >= 60,
        unlockedAt: null,
        progress: Math.min(Math.floor((profile.totalStudyMinutes || 0) / 60), 1),
        total: 1,
        category: 'learning',
      },
      {
        id: 'time_10_hours',
        userId: user.id,
        name: 'Dedicated Learner',
        description: 'Study for 10 hours total',
        unlocked: (profile.totalStudyMinutes || 0) >= 600,
        unlockedAt: null,
        progress: Math.min(Math.floor((profile.totalStudyMinutes || 0) / 60), 10),
        total: 10,
        category: 'learning',
      },
      {
        id: 'time_100_hours',
        userId: user.id,
        name: 'Century Scholar',
        description: 'Study for 100 hours total',
        unlocked: (profile.totalStudyMinutes || 0) >= 6000,
        unlockedAt: null,
        progress: Math.min(Math.floor((profile.totalStudyMinutes || 0) / 60), 100),
        total: 100,
        category: 'learning',
      },

      // 📖 SYLLABUS ACHIEVEMENTS
      {
        id: 'syllabus_uploaded',
        userId: user.id,
        name: 'Curriculum Builder',
        description: 'Upload your first syllabus',
        unlocked: curriculums.length >= 1,
        unlockedAt: null,
        progress: Math.min(curriculums.length, 1),
        total: 1,
        category: 'learning',
      },
      {
        id: 'syllabus_3_subjects',
        userId: user.id,
        name: 'Subject Explorer',
        description: 'Have 3+ subjects in your curriculum',
        unlocked: curriculums.reduce((acc, c) => acc + c.subjects.length, 0) >= 3,
        unlockedAt: null,
        progress: Math.min(curriculums.reduce((acc, c) => acc + c.subjects.length, 0), 3),
        total: 3,
        category: 'learning',
      },

      // 🏆 POINTS ACHIEVEMENTS
      {
        id: 'points_1000',
        userId: user.id,
        name: 'Rising Star',
        description: 'Earn 1,000 XP',
        unlocked: (profile.totalPoints || 0) >= 1000,
        unlockedAt: null,
        progress: Math.min(Math.floor((profile.totalPoints || 0) / 1000), 1),
        total: 1,
        category: 'learning',
      },
      {
        id: 'points_10000',
        userId: user.id,
        name: 'Star Performer',
        description: 'Earn 10,000 XP',
        unlocked: (profile.totalPoints || 0) >= 10000,
        unlockedAt: null,
        progress: Math.min(Math.floor((profile.totalPoints || 0) / 10000), 1),
        total: 1,
        category: 'learning',
      },
      {
        id: 'points_50000',
        userId: user.id,
        name: 'Legend',
        description: 'Earn 50,000 XP',
        unlocked: (profile.totalPoints || 0) >= 50000,
        unlockedAt: null,
        progress: Math.min(Math.floor((profile.totalPoints || 0) / 50000), 1),
        total: 1,
        category: 'learning',
      },
    ];

    return NextResponse.json({
      success: true,
      achievements,
      stats: {
        totalChaptersCompleted,
        totalChapters,
        subjectMastery,
        curriculumsCount: curriculums.length,
      },
    });

  } catch (error: any) {
    console.error('Achievements Fetch Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch achievements.', details: error.message }, 
      { status: 500 }
    );
  }
}