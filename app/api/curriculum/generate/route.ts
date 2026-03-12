// app/api/curriculum/generate/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { inngest } from '@/inngest/client';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import crypto from 'crypto';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '24 h'), // stricter limit
});

const generateSchema = z.object({
  subjects: z.array(z.string()).min(1, 'At least one subject is required'),
  extractedSyllabus: z
    .object({
      subjects: z.array(z.string()).optional(),
      chapters: z
        .array(
          z.object({
            subject: z.string(),
            topics: z.array(z.string()),
          })
        )
        .optional(),
    })
    .nullable()
    .optional(),
  referenceBooks: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      author: z.string().optional(),
    })
  ).default([]),
  educationPath: z.enum(['school', 'diploma', 'bachelor', 'master']),
  classLevel: z.union([z.string(), z.number()]),
  board: z.string().optional(),
  interests: z.array(z.string()).optional(),
  hobbies: z.array(z.string()).optional(),
  learningTempo: z.enum(['EASY', 'NORMAL', 'EXTREME']).optional(),
  currentVibe: z.string().optional(),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  console.log(`[Generate] Starting request ${requestId}`);

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit per user (stricter to prevent abuse)
    const { success } = await ratelimit.limit(`generate_${user.id}`);
    if (!success) {
      return NextResponse.json(
        { error: 'You can only generate 10 curricula per day. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    console.log(`[Generate] Payload received:`, JSON.stringify(body, null, 2));
    const payload = generateSchema.parse(body);

    const {
      subjects,
      extractedSyllabus,
      referenceBooks,
      educationPath,
      classLevel,
      board,
      interests,
      hobbies,
      learningTempo,
      currentVibe,
    } = payload;

    console.log(`[Generate] Creating curriculum for user ${user.id} with ${subjects.length} subjects`);

    // Ensure user has a profile
    let profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) {
      console.log(`[Generate] No profile found, creating one`);
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          fullName: user.email?.split('@')[0] || 'Student',
          currentVibe: currentVibe || 'minimalist',
          learningTempo: learningTempo || 'NORMAL',
          classLevel: typeof classLevel === 'string' ? parseInt(classLevel) || 0 : classLevel,
          board: board || '',
          interests: interests || [],
          hobbies: hobbies || [],
        },
      });
    } else {
      // Update profile with latest interests/hobbies if provided
      if (interests || hobbies || learningTempo || currentVibe) {
        profile = await prisma.profile.update({
          where: { userId: user.id },
          data: {
            ...(interests && { interests }),
            ...(hobbies && { hobbies }),
            ...(learningTempo && { learningTempo }),
            ...(currentVibe && { currentVibe }),
          },
        });
      }
    }

    // Archive any existing curricula for this user
    console.log(`[Generate] Archiving previous curricula`);
    await prisma.curriculum.updateMany({
      where: { userId: user.id, status: { not: 'ARCHIVED' } },
      data: { status: 'ARCHIVED' },
    });

    // Create curriculum WITHOUT subjects/chapters first (they will be added by Inngest)
    const curriculum = await prisma.curriculum.create({
      data: {
        userId: user.id,
        title: `${educationPath.toUpperCase()} - Level ${classLevel}`,
        syllabusText: extractedSyllabus ? JSON.stringify(extractedSyllabus) : '',
        status: 'PENDING',
        educationPath,
        classLevel: String(classLevel),
        board: board || '',
        referenceBooks: referenceBooks,
        // We'll create subjects/chapters later via Inngest to avoid duplication
      },
    });

    console.log(`[Generate] Curriculum skeleton created with ID ${curriculum.id}`);

    // Trigger Inngest background job with all data needed to build subjects/chapters
    await inngest.send({
      name: 'curriculum.generate',
      data: {
        curriculumId: curriculum.id,
        userId: user.id,
        subjects, // list of subject names
        extractedSyllabus,
        referenceBooks: referenceBooks.map(b => b.title), // just titles for AI
        educationPath,
        classLevel: String(classLevel),
        profile: {
          age: profile.age,
          classLevel: profile.classLevel,
          hobbies: profile.hobbies || [],
          interests: profile.interests || [],
          learningTempo: profile.learningTempo,
          currentVibe: profile.currentVibe,
        },
      },
    });

    console.log(`[Generate] Inngest job triggered for curriculum ${curriculum.id}`);

    return NextResponse.json(
      {
        success: true,
        curriculumId: curriculum.id,
        message: 'Curriculum generation started. You will be notified when ready.',
      },
      { status: 202 } // Accepted
    );
  } catch (error: any) {
    console.error(`[Generate] Error in request ${requestId}:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to initialize curriculum generation.' },
      { status: 500 }
    );
  }
}