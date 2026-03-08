import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { inngest } from '@/inngest/client';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';

// Create a new ratelimiter, allowing 20 requests per 24 hours
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '24 h'),
});

// Input validation schema
const generateSchema = z.object({
  subjects: z.array(z.string()),
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
    .optional(),
  referenceBooks: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      author: z.string().optional(),
    })
  ),
  educationPath: z.enum(['school', 'diploma', 'bachelor', 'master']),
  classLevel: z.union([z.string(), z.number()]),
  board: z.string().optional(),
  interests: z.array(z.string()).optional(),
  hobbies: z.array(z.string()).optional(),
  learningTempo: z.enum(['EASY', 'NORMAL', 'EXTREME']).optional(),
  currentVibe: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const { success } = await ratelimit.limit(`ratelimit_ai_${user.id}`);
    if (!success) {
      return NextResponse.json(
        {
          error:
            'AI Rate limit exceeded. Please try again later to protect neural core integrity.',
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
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

    // 1. Build the V2 Curriculum Hierarchy in Prisma
    const curriculum = await prisma.curriculum.create({
      data: {
        userId: user.id,
        title: `${educationPath.toUpperCase()} - Level ${classLevel}`,
        syllabusText: extractedSyllabus ? JSON.stringify(extractedSyllabus) : '',
        status: 'PENDING',
        educationPath,
        classLevel: String(classLevel),
        board: board || '',
        referenceBooks: referenceBooks, // stored as JSON
        // Nested create for Subjects and Chapters
        subjects: {
          create: subjects.map((subName: string) => {
            // Find chapters for this specific subject from the extracted payload
            const subjectChapters =
              extractedSyllabus?.chapters?.find((c) => c.subject === subName)
                ?.topics || [];

            return {
              name: subName,
              status: 'PENDING',
              chapters: {
                create: subjectChapters.map((topic: string, index: number) => ({
                  chapterNumber: index + 1,
                  title: topic,
                  status: 'PENDING',
                  estimatedMinutes: 15, // Default, to be updated later
                })),
              },
            };
          }),
        },
      },
    });

    // 2. Trigger the Inngest Background Job
    await inngest.send({
      name: 'curriculum.generate',
      data: {
        curriculumId: curriculum.id,
        userId: user.id,
        referenceBooks: referenceBooks,
        interests,
        hobbies,
        learningTempo,
        currentVibe,
      },
    });

    return NextResponse.json({ success: true, curriculumId: curriculum.id });
  } catch (error: any) {
    console.error('Matrix Generation Error:', error);

    // Handle Zod validation errors gracefully
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data.', details: error.errors },
        { status: 400 }
      );
    }

    // Generic error for all other cases (no leakage)
    return NextResponse.json(
      { error: 'Failed to initialize curriculum matrix.' },
      { status: 500 }
    );
  }
}