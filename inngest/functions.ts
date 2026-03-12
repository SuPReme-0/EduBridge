// inngest/functions.ts – Updated with subject/chapter creation and planning
import { inngest } from './client';
import { prisma } from '@/lib/db/client';
import {
  generateChapterContent,
  generateCurriculumPlan,          // ✅ import the planning function
  type UserProfile,
  RateLimitError,
} from '@/lib/ai/orchestrator';
import { canSpendTokens, TOKEN_BUDGET } from '@/lib/rate-limit';

// Configuration
const DAILY_BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = '24h';

// ============================================================================
// Helper: determine target chapters per subject (copied from API route)
// ============================================================================
function getTargetChapters(classLevel: string, educationPath: string): number {
  const levelStr = String(classLevel);
  let year = 1;

  const match = levelStr.match(/\d+/);
  if (match) year = parseInt(match[0], 10);

  if (educationPath === 'school') {
    if (year < 1) year = 1;
    if (year > 12) year = 12;
    return Math.floor(8 + (year - 1) * (22 / 11));
  }
  if (educationPath === 'diploma') {
    if (year < 1) year = 1;
    if (year > 3) year = 3;
    return 15 + (year - 1) * 5;
  }
  if (educationPath === 'bachelor') {
    if (year < 1) year = 1;
    if (year > 4) year = 4;
    return 20 + (year - 1) * 5;
  }
  if (educationPath === 'master') {
    if (year < 1) year = 1;
    if (year > 2) year = 2;
    return 25 + (year - 1) * 5;
  }
  return 20;
}

// ============================================================================
// JOB 1: THE DISPATCHER (creates subjects/chapters, then splits into daily batches)
// ============================================================================
export const generateCurriculumJob = inngest.createFunction(
  {
    id: 'curriculum-dispatcher',
    name: 'Dispatch Chapter Generation in Daily Batches',
    retries: 3,
    concurrency: { limit: 1 },
  },
  { event: 'curriculum.generate' },
  async ({ event, step }) => {
    const {
      curriculumId,
      userId,
      subjects,                // array of subject names
      extractedSyllabus,
      referenceBooks,
      educationPath,
      classLevel,
      profile,
    } = event.data as {
      curriculumId: string;
      userId: string;
      subjects: string[];
      extractedSyllabus?: any;
      referenceBooks: string[];
      educationPath: string;
      classLevel: string;
      profile: UserProfile;
    };

    // 1. Determine target chapters per subject
    const targetChaptersPerSubject = getTargetChapters(classLevel, educationPath);

    // 2. For each subject, generate a plan (or fallback) and store in subjectPlans
    const subjectPlans: Record<string, any> = {};

    for (const subjectName of subjects) {
      try {
        const plan = await step.run(`plan-${subjectName}`, async () => {
          return await generateCurriculumPlan(
            userId,
            subjectName,
            profile.classLevel,
            referenceBooks,
            targetChaptersPerSubject
          );
        });
        subjectPlans[subjectName] = plan;
        console.log(`[Dispatcher] ✅ Plan for ${subjectName}: ${plan.chapters.length} chapters`);
      } catch (error) {
        console.error(`[Dispatcher] ⚠️ Plan failed for ${subjectName}, using fallback`, error);
        // Fallback: create basic chapters from syllabus or generic topics
        const fallbackTopics = extractedSyllabus?.chapters?.find((c: any) => c.subject === subjectName)?.topics
          || [`Introduction to ${subjectName}`, `Core Concepts`, `Applications`, `Advanced Topics`];
        const chapters = [];
        for (let i = 0; i < targetChaptersPerSubject; i++) {
          chapters.push({
            chapterNumber: i + 1,
            chapterTitle: fallbackTopics[i % fallbackTopics.length] +
              (i >= fallbackTopics.length ? ` (Part ${Math.floor(i / fallbackTopics.length) + 1})` : ''),
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

    // 3. Persist subjects and chapters to the database
    await step.run('persist-structure', async () => {
      for (let i = 0; i < subjects.length; i++) {
        const subjectName = subjects[i];
        const plan = subjectPlans[subjectName];
        const chapters = plan?.chapters || [];

        await prisma.subject.create({
          data: {
            curriculumId,
            name: subjectName,
            status: 'PENDING',
            order: i,
            chapters: {
              create: chapters.map((ch: any, idx: number) => ({
                chapterNumber: ch.chapterNumber || idx + 1,
                title: ch.chapterTitle || `Chapter ${idx + 1}`,
                status: 'PENDING',
                estimatedMinutes: ch.estimatedMinutes || 15,
                difficultyLevel: 
                  ch.difficulty === 'beginner' ? 3 :
                  ch.difficulty === 'intermediate' ? 6 : 9,
                tags: ch.keyTopics || [],
                order: idx,
                mixedContent: null,
              })),
            },
          },
        });
      }
    });

    // 4. Fetch the now‑populated curriculum
    const curriculum = await step.run('fetch-populated', async () => {
      return await prisma.curriculum.findUnique({
        where: { id: curriculumId },
        include: {
          subjects: {
            include: {
              chapters: { orderBy: { order: 'asc' } },
            },
          },
        },
      });
    });
    if (!curriculum) throw new Error('Curriculum not found after creation');

    // 5. Flatten all chapters for batching
    const allChapters = curriculum.subjects
      .flatMap((sub) =>
        sub.chapters.map((ch) => ({
          chapterId: ch.id,
          subjectName: sub.name,
          chapterTitle: ch.title,
          order: ch.order,
          subjectId: sub.id,
          difficultyLevel: ch.difficultyLevel,
        }))
      )
      .sort((a, b) => a.order - b.order);

    if (allChapters.length === 0) throw new Error('No chapters found');

    const totalChapters = allChapters.length;

    // 6. Split into daily batches (unchanged)
    for (let i = 0; i < totalChapters; i += DAILY_BATCH_SIZE) {
      const batch = allChapters.slice(i, i + DAILY_BATCH_SIZE);
      await step.sendEvent(`batch-${Math.floor(i / DAILY_BATCH_SIZE) + 1}`, {
        name: 'chapter.batch',
        data: {
          chapters: batch.map(ch => ({
            chapterId: ch.chapterId,
            subjectName: ch.subjectName,
            chapterTitle: ch.chapterTitle,
            order: ch.order,
            difficultyLevel: ch.difficultyLevel,
          })),
          userId,
          referenceBooks,
          profile,
          totalChapters,
        },
      });

      if (i + DAILY_BATCH_SIZE < totalChapters) {
        await step.sleep(`delay-after-batch-${Math.floor(i / DAILY_BATCH_SIZE) + 1}`, DELAY_BETWEEN_BATCHES);
      }
    }

    await step.run('mark-curriculum-active', async () => {
      await prisma.curriculum.update({
        where: { id: curriculumId },
        data: { status: 'GENERATING' },
      });
    });

    return { success: true, totalChapters, batches: Math.ceil(totalChapters / DAILY_BATCH_SIZE) };
  }
);

// ============================================================================
// JOB 2: CHAPTER BATCH PROCESSOR (unchanged)
// ============================================================================
export const generateChapterBatchJob = inngest.createFunction(
  {
    id: 'chapter-batch',
    name: 'Process a Daily Batch of Chapters',
    concurrency: { limit: 5 },
  },
  { event: 'chapter.batch' },
  async ({ event, step }) => {
    const { chapters, userId, referenceBooks, profile, totalChapters } = event.data as {
      chapters: Array<{
        chapterId: string;
        subjectName: string;
        chapterTitle: string;
        order: number;
        difficultyLevel: number;
      }>;
      userId: string;
      referenceBooks: string[];
      profile: UserProfile;
      totalChapters: number;
    };

    await Promise.all(
      chapters.map(async (ch) => {
        const estimatedTokens = TOKEN_BUDGET.perChapter.blueprint +
          (TOKEN_BUDGET.perChapter.perTopic * 5);
        const enough = await canSpendTokens(userId, estimatedTokens);
        if (!enough) {
          await step.sleep('insufficient-tokens', '24h');
          await step.sendEvent(`retry-${ch.chapterId}`, {
            name: 'chapter.generate',
            data: {
              ...ch,
              userId,
              referenceBooks,
              profile,
              totalChapters,
              chapterOrder: ch.order + 1,
            },
          });
          return;
        }

        await step.sendEvent(`generate-${ch.chapterId}`, {
          name: 'chapter.generate',
          data: {
            chapterId: ch.chapterId,
            userId,
            referenceBooks,
            subjectName: ch.subjectName,
            chapterTitle: ch.chapterTitle,
            curriculumId: undefined,
            totalChapters,
            chapterOrder: ch.order + 1,
            difficultyLevel: ch.difficultyLevel,
            profile,
          },
        });
      })
    );

    return { success: true, processed: chapters.length };
  }
);

// ============================================================================
// JOB 3: CHAPTER GENERATOR (unchanged)
// ============================================================================
export const generateChapterJob = inngest.createFunction(
  {
    id: 'chapter-generator',
    name: 'Generate Interactive Chapter via Orchestrator',
    retries: 3,
    concurrency: { limit: 5 },
  },
  { event: 'chapter.generate' },
  async ({ event, step }) => {
    const {
      chapterId,
      userId,
      referenceBooks,
      subjectName,
      chapterTitle,
      curriculumId,
      totalChapters,
      chapterOrder,
      profile,
    } = event.data as {
      chapterId: string;
      userId: string;
      referenceBooks: string[];
      subjectName: string;
      chapterTitle: string;
      curriculumId?: string;
      totalChapters?: number;
      chapterOrder?: number;
      profile: UserProfile;
    };

    const estimatedTokens = 5000;
    const enough = await canSpendTokens(userId, estimatedTokens);
    if (!enough) {
      await step.sleep('token-exhausted', '24h');
      await step.sendEvent(`retry-${chapterId}`, { name: 'chapter.generate', data: event.data });
      return;
    }

    const context = await step.run('fetch-chapter-context', async () => {
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: {
          subject: {
            include: {
              curriculum: {
                include: { user: { include: { profile: true } } },
              },
            },
          },
        },
      });
      if (!chapter) throw new Error('Chapter not found');
      const dbProfile = chapter.subject.curriculum.user.profile;
      if (!dbProfile) throw new Error('Profile not found');

      await prisma.chapter.update({
        where: { id: chapterId },
        data: { status: 'GENERATING', generationProgress: 0, errorMessage: null },
      });
      return { chapter, profile: dbProfile };
    });

    const { chapterNumber, previousChapterTitle, nextChapterTitle } = await step.run('get-chapter-position', async () => {
      const order = chapterOrder ?? context.chapter.order + 1;
      const allChapters = await prisma.chapter.findMany({
        where: { subject: { curriculumId: context.chapter.subject.curriculumId } },
        orderBy: { order: 'asc' },
        select: { id: true, title: true, order: true },
      });
      const index = allChapters.findIndex(ch => ch.id === chapterId);
      if (index === -1) throw new Error('Chapter not found in curriculum');
      return {
        chapterNumber: order,
        previousChapterTitle: allChapters[index - 1]?.title,
        nextChapterTitle: allChapters[index + 1]?.title,
      };
    });

    let aiResponse;
    try {
      aiResponse = await step.run('run-orchestrator', async () => {
        await prisma.chapter.update({ where: { id: chapterId }, data: { generationProgress: 50 } });

        const result = await generateChapterContent({
          userId,
          chapterTitle,
          subjectName,
          referenceBooks: referenceBooks || [],
          previousChapterTitle,
          nextChapterTitle,
          chapterNumber,
          totalChapters: totalChapters ?? (await prisma.chapter.count({ where: { subject: { curriculumId: context.chapter.subject.curriculumId } } })),
          profile: context.profile,
        });

        await prisma.chapter.update({ where: { id: chapterId }, data: { generationProgress: 90 } });
        return result;
      });
    } catch (error: any) {
      if (error instanceof RateLimitError) {
        console.log(`[Inngest] Rate limit hit for chapter ${chapterId}, retry after ${error.retryAfter}s`);
        await step.sleep('rate-limit-wait', `${error.retryAfter}s`);
        await step.sendEvent(`retry-${chapterId}`, {
          name: 'chapter.generate',
          data: event.data,
        });
        return { success: false, rescheduled: true, reason: 'rate_limit' };
      }

      await prisma.chapter.update({
        where: { id: chapterId },
        data: { generationProgress: 100, status: 'FAILED', errorMessage: error.message },
      });
      throw error;
    }

    await step.run('save-mixed-content', async () => {
      const totalMinutes = aiResponse.blocks.reduce((acc: number, block: any) => acc + (block.estimatedReadTime || 5), 0);

      await prisma.chapter.update({
        where: { id: chapterId },
        data: {
          mixedContent: aiResponse.blocks as any,
          status: 'COMPLETED',
          estimatedMinutes: totalMinutes || aiResponse.totalEstimatedMinutes || 30,
          generationProgress: 100,
          completedAt: new Date(),
        },
      });

      const allChapters = await prisma.chapter.findMany({
        where: { subject: { curriculumId: context.chapter.subject.curriculumId } },
        select: { status: true },
      });
      const allComplete = allChapters.every((ch) => ch.status === 'COMPLETED');

      if (allComplete) {
        await prisma.curriculum.update({
          where: { id: context.chapter.subject.curriculumId },
          data: { status: 'COMPLETED' },
        });
        await prisma.profile.update({ where: { userId }, data: { totalPoints: { increment: 500 } } });
      }
    });

    return {
      success: true,
      chapterId,
      blocksGenerated: aiResponse.blocks.length,
      totalTopics: aiResponse.totalTopics,
    };
  }
);

// ============================================================================
// JOB 4: ERROR RECOVERY (unchanged)
// ============================================================================
export const retryFailedChaptersJob = inngest.createFunction(
  {
    id: 'retry-failed-chapters',
    name: 'Retry Failed Chapter Generations',
    retries: 1,
    concurrency: { limit: 1 },
  },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    const failedChapters = await step.run('find-failed-chapters', async () => {
      return await prisma.chapter.findMany({
        where: {
          status: 'FAILED',
          updatedAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        },
        include: {
          subject: {
            include: {
              curriculum: { include: { user: { include: { profile: true } } } },
            },
          },
        },
      });
    });

    if (failedChapters.length === 0) return { success: true, retried: 0 };

    for (let i = 0; i < failedChapters.length; i++) {
      const chapter = failedChapters[i];
      if (i > 0) await step.sleep(`delay-before-retry-${i + 1}`, '60s');

      const refBooks = Array.isArray(chapter.subject.curriculum.referenceBooks)
        ? chapter.subject.curriculum.referenceBooks.map((b: any) => b.title)
        : [];

      await step.sendEvent(`retry-chapter-${i + 1}`, {
        name: 'chapter.generate',
        data: {
          chapterId: chapter.id,
          userId: chapter.subject.curriculum.userId,
          referenceBooks: refBooks,
          subjectName: chapter.subject.name,
          chapterTitle: chapter.title,
          curriculumId: chapter.subject.curriculumId,
          profile: {
            age: chapter.subject.curriculum.user.profile?.age,
            classLevel: chapter.subject.curriculum.user.profile?.classLevel || 10,
            hobbies: chapter.subject.curriculum.user.profile?.hobbies || [],
            interests: chapter.subject.curriculum.user.profile?.interests || [],
            learningTempo: chapter.subject.curriculum.user.profile?.learningTempo || 'NORMAL',
            currentVibe: chapter.subject.curriculum.user.profile?.currentVibe || 'minimalist',
          },
        },
      });
    }

    return { success: true, retried: failedChapters.length };
  }
);