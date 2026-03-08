import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { z } from 'zod';

// Validation Schema
const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  age: z.number().min(5).max(100).optional(),
  gender: z.string().optional(),
  school: z.string().max(200).optional(),
  classLevel: z.number().min(1).max(12).optional(),
  board: z.string().max(50).optional(),
  interests: z.array(z.string()).max(10).optional(),
  hobbies: z.array(z.string()).max(10).optional(),
  learningTempo: z.enum(['EASY', 'NORMAL', 'EXTREME']).optional(),
  currentVibe: z.string().max(50).optional(),
  fontSize: z.number().min(12).max(24).optional(),
  reduceMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
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

    // Parse & Validate Body
    const body = await req.json();
    const validatedData = updateProfileSchema.parse(body);

    // Update Profile
    const updatedProfile = await prisma.profile.update({
      where: { userId: user.id },
      data: validatedData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          }
        }
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[Profile UPDATE] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: 'Profile updated successfully.',
    }, {
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Profile UPDATE] Error in ${duration}ms | Request: ${requestId}`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed.',
          details: error.errors 
        }, 
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update profile.' }, 
      { status: 500 }
    );
  }
}