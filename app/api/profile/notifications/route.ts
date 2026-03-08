import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { z } from 'zod';

// Validation Schema
const notificationSettingsSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  reminders: z.boolean().optional(),
  achievements: z.boolean().optional(),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many update requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate Input
    const body = await req.json();
    const validatedData = notificationSettingsSchema.parse(body);

    // Update Profile
    const updatedProfile = await prisma.profile.update({
      where: { userId: user.id },
      data: {
        notificationSettings: validatedData,
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[Notifications Update] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      message: 'Notification settings saved.',
      settings: updatedProfile.notificationSettings,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Notifications Update] Error in ${duration}ms | Request: ${requestId}`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data.', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save notification settings.' },
      { status: 500 }
    );
  }
}