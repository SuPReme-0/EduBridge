import { inngest } from './client';
import { prisma } from '@/lib/db/client';
import { generateChapterContent } from '@/lib/ai/orchestrator'; // 🧠 BRING IN THE MASTER ENGINE

// ============================================================================
// JOB 1: THE DISPATCHER (Fan-out Pattern)
// ============================================================================
export const generateCurriculumJob = inngest.createFunction(
  {
    id: 'curriculum-dispatcher',
    name: 'Dispatch Chapter Generation Jobs',
    retries: 3,
    concurrency: { limit: 2 },
  },
  { event: 'curriculum.generate' },
  async ({ event, step }) => {
    const { curriculumId, userId, referenceBooks } = event.data;

    // Step 1: Fetch the pre-built structure from the database
    const curriculum = await step.run('fetch-structure', async () => {
      return await prisma.curriculum.findUnique({
        where: { id: curriculumId },
        include: {
          subjects: {
            include: {
              chapters: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });
    });

    if (!curriculum) {
      throw new Error('Curriculum not found');
    }

    // Step 2: Collect all chapter IDs across all subjects
    const allChapters = curriculum.subjects.flatMap((sub) => sub.chapters);

    if (allChapters.length === 0) {
      throw new Error('No chapters found in curriculum');
    }

    // Step 3: Dispatch a 'chapter.generate' event for EVERY chapter
    await step.sendEvent(
      'dispatch-chapters',
      allChapters.map((chapter) => ({
        name: 'chapter.generate',
        data: {
          chapterId: chapter.id,
          userId: userId,
          referenceBooks: referenceBooks,
          subjectName: chapter.subjectId || 'General',
          chapterTitle: chapter.title,
        },
      }))
    );

    // Step 4: Mark the overarching curriculum as active
    await step.run('mark-curriculum-active', async () => {
      await prisma.curriculum.update({
        where: { id: curriculumId },
        data: { status: 'GENERATING' },
      });
    });

    return { success: true, dispatchedChapters: allChapters.length };
  }
);

// ============================================================================
// JOB 2: THE MASTER TUTOR ENGINE (Connected to Orchestrator)
// ============================================================================
export const generateChapterJob = inngest.createFunction(
  {
    id: 'chapter-generator',
    name: 'Generate Interactive Chapter via Orchestrator',
    retries: 2,
    concurrency: { limit: 2 },
  },
  { event: 'chapter.generate' },
  async ({ event, step }) => {
    const { chapterId, userId, referenceBooks, subjectName, chapterTitle } = event.data;

    // Step 1: Fetch Context & Profile
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
      const profile = chapter.subject.curriculum.user.profile;
      if (!profile) throw new Error('Profile not found');

      await prisma.chapter.update({
        where: { id: chapterId },
        data: { status: 'GENERATING' },
      });

      return { chapter, profile };
    });

    // Step 2: Generate Content securely using your custom Orchestrator!
    const aiResponse = await step.run('run-orchestrator', async () => {
      return await generateChapterContent({
        userId: userId,
        topic: chapterTitle,
        subjectName: subjectName,
        referenceBooks: referenceBooks || ["Standard Curriculum"],
        profile: {
          age: context.profile.age,
          classLevel: context.profile.classLevel || 10,
          hobbies: context.profile.hobbies || [],
          interests: context.profile.interests || [],
          learningTempo: (context.profile.learningTempo as any) || 'NORMAL',
          currentVibe: context.profile.currentVibe || 'minimalist',
        }
      });
    });

    // Step 3: Save the flawless JSON to Postgres AND UPDATE THE USER'S THEME
    await step.run('save-mixed-content-and-theme', async () => {
      // Calculate total estimated time
      const totalMinutes = aiResponse.blocks.reduce(
        (acc: number, block: any) => acc + (block.estimatedReadTime || 3),
        0
      );

      // Save the chapter content
      await prisma.chapter.update({
        where: { id: chapterId },
        data: {
          mixedContent: aiResponse.blocks as any, // 100% Zod validated blocks
          status: 'COMPLETED',
          estimatedMinutes: totalMinutes,
        },
      });

      // Update the user's global profile theme
      await prisma.profile.update({
        where: { userId: userId },
        data: {
          currentVibe: aiResponse.dynamicVibe,
          lastActiveAt: new Date(),
        },
      });

      // Check if all chapters are complete, then update curriculum
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

        // Award completion bonus
        await prisma.profile.update({
          where: { userId: userId },
          data: { totalPoints: { increment: 500 } },
        });
      }
    });

    return { success: true, chapterId, newTheme: aiResponse.dynamicVibe };
  }
);