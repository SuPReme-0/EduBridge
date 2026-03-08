import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { inngest } from '@/inngest/client';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { generateCurriculumPlan, type UserProfile } from '@/lib/ai/orchestrator';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '24 h'),
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
  const requestId = crypto.randomUUID();
  console.log(`[Generate] Starting request ${requestId}`);

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = await ratelimit.limit(`ratelimit_ai_${user.id}`);
    if (!success) {
      return NextResponse.json(
        { error: 'AI Rate limit exceeded. Please try again later.' },
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
      console.log(`[Generate] No profile found for user ${user.id}, creating one`);
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          fullName: user.email?.split('@')[0] || 'Student',
          currentVibe: 'minimalist',
          learningTempo: 'NORMAL',
          classLevel: 0,
          board: '',
        },
      });
    }

    // Archive any existing curricula for this user
    console.log(`[Generate] Archiving previous curricula for user ${user.id}`);
    await prisma.curriculum.updateMany({
      where: { userId: user.id },
      data: { status: 'ARCHIVED' },
    });

    const classLevelNum = typeof classLevel === 'string' ? parseInt(classLevel) : classLevel;
    const bookTitles = referenceBooks.map((b) => b.title);
    
    console.log(`[Generate] Generating AI curriculum plan for ${subjects.length} subjects...`);
    
    const subjectPlans: Record<string, any> = {};
    
    for (const subjectName of subjects) {
      try {
        const plan = await generateCurriculumPlan(
          subjectName,
          classLevelNum,
          bookTitles,
          30 // chapters per subject
        );
        subjectPlans[subjectName] = plan;
        console.log(`[Generate] ✅ Plan for ${subjectName}: ${plan.chapters.length} chapters`);
      } catch (error) {
        console.error(`[Generate] Failed to generate plan for ${subjectName}:`, error);
        const fallbackTopics = extractedSyllabus?.chapters?.find(c => c.subject === subjectName)?.topics 
          || [`Introduction to ${subjectName}`, `Core Concepts`, `Applications`, `Advanced Topics`];
        
        subjectPlans[subjectName] = {
          chapters: fallbackTopics.map((topic, idx) => ({
            chapterNumber: idx + 1,
            chapterTitle: topic,
            keyTopics: [topic],
            estimatedMinutes: 15,
            difficulty: idx < 10 ? 'beginner' : idx < 20 ? 'intermediate' : 'advanced',
          })),
          totalEstimatedMinutes: fallbackTopics.length * 15,
          learningObjectives: [`Master ${subjectName}`],
        };
      }
    }

    // Create new curriculum with nested subjects and chapters
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
        subjects: {
          create: subjects.map((subName: string, subIndex: number) => {
            const plan = subjectPlans[subName];
            const chapters = plan?.chapters || [];
            
            return {
              name: subName,
              status: 'PENDING',
              order: subIndex,
              chapters: {
                create: chapters.map((chapterPlan: any, chapIndex: number) => ({
                  chapterNumber: chapterPlan.chapterNumber || chapIndex + 1,
                  title: chapterPlan.chapterTitle || chapterPlan.title || `Chapter ${chapIndex + 1}`,
                  status: 'PENDING',
                  estimatedMinutes: chapterPlan.estimatedMinutes || 15,
                  difficultyLevel: 
                    chapterPlan.difficulty === 'beginner' ? 3 :
                    chapterPlan.difficulty === 'intermediate' ? 6 : 9,
                  tags: chapterPlan.keyTopics || [],
                  order: chapIndex,
                  mixedContent: null,
                })),
              },
            };
          }),
        },
      },
      include: {
        subjects: {
          include: {
            chapters: true,
          },
        },
      },
    });

    console.log(`[Generate] Curriculum created with ID ${curriculum.id}`);
    const totalChapters = curriculum.subjects.reduce((acc, s) => acc + s.chapters.length, 0);
    console.log(`[Generate] Chapters created: ${totalChapters}`);

    // Trigger Inngest background job with full context
    await inngest.send({
      name: 'curriculum.generate',
      data: {
        curriculumId: curriculum.id,
        userId: user.id,
        referenceBooks: bookTitles,
        interests,
        hobbies,
        learningTempo,
        currentVibe,
        profile: {
          age: profile.age,
          classLevel: profile.classLevel,
          hobbies: profile.hobbies,
          interests: profile.interests,
          learningTempo: profile.learningTempo,
          currentVibe: profile.currentVibe,
        } as UserProfile,
        subjectPlans: Object.entries(subjectPlans).reduce((acc, [subject, plan]) => {
          acc[subject] = {
            totalChapters: plan.chapters?.length || 0,
            learningObjectives: plan.learningObjectives || [],
          };
          return acc;
        }, {} as Record<string, any>),
      },
    });

    console.log(`[Generate] Inngest job triggered for curriculum ${curriculum.id}`);

    return NextResponse.json({ 
      success: true, 
      curriculumId: curriculum.id,
      totalChapters,
      message: `Curriculum created with ${totalChapters} chapters. Generation will begin shortly.`,
    });
  } catch (error: any) {
    console.error(`[Generate] Error in request ${requestId}:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to initialize curriculum matrix.' },
      { status: 500 }
    );
  }
}