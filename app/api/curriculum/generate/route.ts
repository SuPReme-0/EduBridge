// app/api/curriculum/generate/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { inngest } from '@/inngest/client';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { generateCurriculumPlan, type UserProfile } from '@/lib/ai/orchestrator';
import crypto from 'crypto';

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
    .nullable() // <-- add .nullable()
    .optional(),
  referenceBooks: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      author: z.string().optional(),
    })
  ).default([]), // default to empty array
  educationPath: z.enum(['school', 'diploma', 'bachelor', 'master']),
  classLevel: z.union([z.string(), z.number()]),
  board: z.string().optional(),
  interests: z.array(z.string()).optional(),
  hobbies: z.array(z.string()).optional(),
  learningTempo: z.enum(['EASY', 'NORMAL', 'EXTREME']).optional(),
  currentVibe: z.string().optional(),
});

// ============================================================================
// Determine target chapters per subject based on education path and year
// ============================================================================
function getTargetChapters(classLevel: string | number, educationPath: string): number {
  // Convert to string and extract numeric part (e.g., "10", "bachelor-3" -> 3)
  const levelStr = String(classLevel);
  let year = 1; // default

  if (educationPath === 'school') {
    // Grades 1-12
    const grade = parseInt(levelStr, 10);
    if (!isNaN(grade) && grade >= 1 && grade <= 12) {
      year = grade;
    }
    // Map grade to chapters: grade 1 → 8, grade 12 → 30
    return Math.floor(8 + (year - 1) * (22 / 11)); // linear 8..30
  }

  if (educationPath === 'diploma') {
    // Diploma years: 1-3
    const match = levelStr.match(/\d+/);
    if (match) {
      year = parseInt(match[0], 10);
      if (year < 1) year = 1;
      if (year > 3) year = 3;
    }
    // Year 1 → 15, Year 3 → 25
    return 15 + (year - 1) * 5; // 15,20,25
  }

  if (educationPath === 'bachelor') {
    // Bachelor years: 1-4
    const match = levelStr.match(/\d+/);
    if (match) {
      year = parseInt(match[0], 10);
      if (year < 1) year = 1;
      if (year > 4) year = 4;
    }
    // Year 1 → 20, Year 4 → 35
    return 20 + (year - 1) * 5; // 20,25,30,35
  }

  if (educationPath === 'master') {
    // Master years: 1-2
    const match = levelStr.match(/\d+/);
    if (match) {
      year = parseInt(match[0], 10);
      if (year < 1) year = 1;
      if (year > 2) year = 2;
    }
    // Year 1 → 25, Year 2 → 30
    return 25 + (year - 1) * 5; // 25,30
  }

  // Fallback
  return 20;
}

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
          currentVibe: currentVibe || 'minimalist',
          learningTempo: learningTempo || 'NORMAL',
          classLevel: typeof classLevel === 'string' ? parseInt(classLevel) || 0 : classLevel,
          board: board || '',
        },
      });
    }

    // Archive any existing curricula for this user
    console.log(`[Generate] Archiving previous curricula for user ${user.id}`);
    await prisma.curriculum.updateMany({
      where: { userId: user.id },
      data: { status: 'ARCHIVED' },
    });
    
    const bookTitles = referenceBooks.map((b) => b.title); // if empty, returns []
// In generateCurriculumPlan, you'll need to handle empty list (maybe pass a default)
    
    // Determine target chapters per subject (independent of tempo)
    const targetChaptersPerSubject = getTargetChapters(classLevel, educationPath);
    console.log(`[Generate] Target chapters per subject: ${targetChaptersPerSubject}`);

    const subjectPlans: Record<string, any> = {};

    for (const subjectName of subjects) {
      try {
        const plan = await generateCurriculumPlan(
          user.id,
          subjectName,
          profile.classLevel, // numeric grade
          bookTitles,
          targetChaptersPerSubject // dynamic count
        );
        subjectPlans[subjectName] = plan;
        console.log(`[Generate] ✅ Plan for ${subjectName}: ${plan.chapters.length} chapters`);
      } catch (error) {
        console.error(`[Generate] Failed to generate plan for ${subjectName}:`, error);
        // Fallback: create basic chapters up to target count
        const fallbackTopics = extractedSyllabus?.chapters?.find(c => c.subject === subjectName)?.topics 
          || [`Introduction to ${subjectName}`, `Core Concepts`, `Applications`, `Advanced Topics`];
        
        const chapters = [];
        for (let i = 0; i < targetChaptersPerSubject; i++) {
          chapters.push({
            chapterNumber: i + 1,
            chapterTitle: fallbackTopics[i % fallbackTopics.length] + 
              (i >= fallbackTopics.length ? ` (Part ${Math.floor(i/fallbackTopics.length)+1})` : ''),
            keyTopics: [fallbackTopics[i % fallbackTopics.length]],
            estimatedMinutes: 15,
            difficulty: i < targetChaptersPerSubject * 0.33 ? 'beginner' 
                     : i < targetChaptersPerSubject * 0.66 ? 'intermediate' 
                     : 'advanced',
          });
        }

        subjectPlans[subjectName] = {
          chapters,
          totalEstimatedMinutes: chapters.length * 15,
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
        learningTempo: learningTempo || profile.learningTempo,
        currentVibe: currentVibe || profile.currentVibe,
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