import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting (50 per day - prevents abuse)
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many streak updates. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = await req.json();
    if (!success) {
      return NextResponse.json({ message: 'No streak update required.' });
    }

    // Get Profile
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    const now = new Date();
    const lastActive = profile.lastActiveAt ? new Date(profile.lastActiveAt) : new Date(0);

    // Reset hours for accurate day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActiveDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());

    const differenceInDays = Math.floor((today.getTime() - lastActiveDay.getTime()) / (1000 * 3600 * 24));

    let newStreak = profile.currentStreak;
    let shouldUpdate = false;

    if (differenceInDays === 0) {
      // Same day - no change needed, but ensure streak is at least 1
      if (newStreak === 0) {
        newStreak = 1;
        shouldUpdate = true;
      }
    } else if (differenceInDays === 1) {
      // Consecutive day - increment streak
      newStreak += 1;
      shouldUpdate = true;
    } else if (differenceInDays > 1) {
      // Missed days - reset streak
      newStreak = 1;
      shouldUpdate = true;
    }
    // differenceInDays < 0 shouldn't happen, but ignore if it does

    if (!shouldUpdate) {
      return NextResponse.json({
        success: true,
        currentStreak: newStreak,
        message: 'No update needed.',
      });
    }

    // Update Profile
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(profile.longestStreak || 0, newStreak),
        lastActiveAt: now,
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[Streak Update] Success in ${duration}ms | Streak: ${newStreak} | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      currentStreak: newStreak,
      message: 'Streak updated successfully.',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Streak Update] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to update streak.' },
      { status: 500 }
    );
  }
}