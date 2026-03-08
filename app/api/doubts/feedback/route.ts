import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { z } from 'zod';

const feedbackSchema = z.object({
  messageId: z.string().min(1, "Message ID is required"),
  type: z.enum(['like', 'dislike'], {
    errorMap: () => ({ message: "Feedback type must be 'like' or 'dislike'" })
  }),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many feedback submissions. Please slow down.' }, 
        { status: 429 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const authResult = await supabase.auth.getUser();
    const user = authResult.data?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = feedbackSchema.parse(body);

    // Check for duplicate feedback
    const existingFeedback = await prisma.feedback.findFirst({
      where: {
        userId: user.id,
        messageId: validatedData.messageId,
      },
    });

    if (existingFeedback) {
      // ✅ Update existing feedback - Prisma auto-manages updatedAt
      await prisma.feedback.update({
        where: { id: existingFeedback.id },
        data: {
          type: validatedData.type,
        },
      });
    } else {
      // ✅ Create new feedback
      await prisma.feedback.create({
        data: {
          userId: user.id,
          messageId: validatedData.messageId,
          type: validatedData.type,
        },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Feedback] Success | Request: ${requestId} | Duration: ${duration}ms`);

    return NextResponse.json({ 
      success: true, 
      message: 'Feedback recorded successfully.',
      updated: !!existingFeedback
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Feedback] Error | Request: ${requestId} | Duration: ${duration}ms`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid feedback data.', 
          details: error.errors.map((e: any) => e.message) 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit feedback. Please try again.' }, 
      { status: 500 }
    );
  }
}