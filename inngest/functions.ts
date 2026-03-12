// inngest/functions.ts – Complete updated version for the new orchestrator
import { inngest } from './client';
import { prisma } from '@/lib/db/client';
import {
  generateChapterContent,
  type UserProfile,
  RateLimitError,          // ✅ now exported from orchestrator
} from '@/lib/ai/orchestrator';
import { canSpendTokens, TOKEN_BUDGET } from '@/lib/rate-limit';

// Configuration
const DAILY_BATCH_SIZE = 5;               // chapters per user per day
const DELAY_BETWEEN_BATCHES = '24h';       // one day between batches
const RETRY_DELAY = '24h';                 // when out of tokens, retry next day

// ============================================================================
// JOB 1: THE DISPATCHER (splits curriculum into daily batches)
// ============================================================================
export const generateCurriculumJob = inngest.createFunction(
  {
    id: 'curriculum-dispatcher',
    name: 'Dispatch Chapter Generation in Daily Batches',
    retries: 3,
    concurrency: { limit: 1 }, // one curriculum at a time to avoid overload
  },
  { event: 'curriculum.generate' },
  async ({ event, step }) => {
    const { curriculumId, userId, referenceBooks, profile } = event.data as {
      curriculumId: string;
      userId: string;
      referenceBooks: string[];
      profile: UserProfile;
    };

    // Fetch curriculum structure
    const curriculum = await step.run('fetch-structure', async () => {
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
    if (!curriculum) throw new Error('Curriculum not found');

    // Flatten all chapters with subject info
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

    // Split into daily batches
    for (let i = 0; i < totalChapters; i += DAILY_BATCH_SIZE) {
      const batch = allChapters.slice(i, i + DAILY_BATCH_SIZE);

      // Dispatch this batch
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

      // If not the last batch, wait 24 hours before next batch
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
// JOB 2: CHAPTER BATCH PROCESSOR (handles one batch, checks tokens)
// ============================================================================
export const generateChapterBatchJob = inngest.createFunction(
  {
    id: 'chapter-batch',
    name: 'Process a Daily Batch of Chapters',
    concurrency: { limit: 5 }, // allow multiple batches from different users concurrently
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

    // Process chapters in parallel (each will independently check tokens)
    await Promise.all(
      chapters.map(async (ch) => {
        // Estimate token cost for this chapter (rough)
        const estimatedTokens = TOKEN_BUDGET.perChapter.blueprint +
          (TOKEN_BUDGET.perChapter.perTopic * 5); // assume 5 topics

        // Check if user has enough tokens for today
        const enough = await canSpendTokens(userId, estimatedTokens);
        if (!enough) {
          // Not enough tokens – reschedule this chapter for tomorrow
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

        // Enough tokens – send for generation
        await step.sendEvent(`generate-${ch.chapterId}`, {
          name: 'chapter.generate',
          data: {
            chapterId: ch.chapterId,
            userId,
            referenceBooks,
            subjectName: ch.subjectName,
            chapterTitle: ch.chapterTitle,
            curriculumId: undefined, // will be fetched from chapter if needed
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
// JOB 3: CHAPTER GENERATOR (actual content generation with rate‑limit handling)
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

    // Pre‑check token availability (rough estimate)
    const estimatedTokens = 5000; // adjust based on two‑stage expansion
    const enough = await canSpendTokens(userId, estimatedTokens);
    if (!enough) {
      // Still not enough? reschedule for tomorrow.
      await step.sleep('token-exhausted', '24h');
      await step.sendEvent(`retry-${chapterId}`, { name: 'chapter.generate', data: event.data });
      return;
    }

    // Fetch chapter context
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

    // Get chapter position
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

    // Generate content
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
      // Handle rate‑limit errors specially
      if (error instanceof RateLimitError) {
        // Log the rate limit
        console.log(`[Inngest] Rate limit hit for chapter ${chapterId}, retry after ${error.retryAfter}s`);

        // ❌ Do not change status to 'RATE_LIMITED' unless your Prisma enum includes it.
        // The chapter remains in 'GENERATING' state, and the orchestrator's cache preserves progress.

        // Wait exactly the required time and then reschedule the same event
        await step.sleep('rate-limit-wait', `${error.retryAfter}s`);
        await step.sendEvent(`retry-${chapterId}`, {
          name: 'chapter.generate',
          data: event.data,
        });

        // Return early – this run is considered successful (the real work is deferred)
        return { success: false, rescheduled: true, reason: 'rate_limit' };
      }

      // For other errors, mark as FAILED and rethrow
      await prisma.chapter.update({
        where: { id: chapterId },
        data: { generationProgress: 100, status: 'FAILED', errorMessage: error.message },
      });
      throw error;
    }

    // Save content (token recording is already done inside the orchestrator)
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

      // Check if curriculum is fully complete
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
// JOB 4: ERROR RECOVERY – now only retries FAILED chapters (rate‑limited ones are handled separately)
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