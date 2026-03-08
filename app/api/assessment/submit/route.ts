import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const GradingSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
  keywords: z.array(z.string()),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.assessment, clientIp);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many submissions. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chapterId, answers, timeSpentSeconds } = await req.json();
    if (!chapterId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Invalid submission data.' }, { status: 400 });
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        homework: true,
        subject: {
          include: {
            curriculum: { select: { userId: true } }
          }
        }
      }
    });

    if (!chapter || chapter.subject.curriculum.userId !== user.id) {
      return NextResponse.json({ error: 'Chapter not found or access denied.' }, { status: 404 });
    }

    const questions = chapter.homework?.tasks as any[] || [];
    if (questions.length === 0) {
      return NextResponse.json({ error: 'No assessment available for this chapter.' }, { status: 400 });
    }

    let totalScore = 0;
    let maxScore = 0;
    const gradedAnswers: any[] = [];

    for (const answer of answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) continue;

      maxScore += question.points || 10;
      let questionScore = 0;

      if (['single_mcq', 'multiple_mcq', 'true_false', 'image_mcq'].includes(question.type)) {
        const isCorrect = Array.isArray(question.correctAnswer)
          ? JSON.stringify(answer.value.sort()) === JSON.stringify(question.correctAnswer.sort())
          : answer.value === question.correctAnswer;

        questionScore = isCorrect ? (question.points || 10) : 0;
        totalScore += questionScore;

        gradedAnswers.push({
          questionId: question.id,
          isCorrect,
          score: questionScore,
          maxScore: question.points || 10,
          userAnswer: answer.value,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
        });
      }

      if (['short_answer', 'long_answer'].includes(question.type)) {
        try {
          const { object: grading } = await generateObject({
            model: groq('llama-3.1-8b-instant'), // fast 8B model for grading
            providerOptions: {
              groq: {
                structuredOutputs: false,
                response_format: { type: 'json_object' },
              },
            },
            system: `You are an expert grader. Grade this ${question.type === 'short_answer' ? 'short' : 'long'} answer fairly.
            Question: ${question.prompt}
            Correct Answer Reference: ${question.correctAnswer}
            Keywords to look for: ${(question as any).keywords?.join(', ') || 'N/A'}
            
            Score 0-100 based on accuracy, completeness, and understanding.`,
            prompt: `Student Answer: ${answer.value}`,
            schema: GradingSchema,
          });

          questionScore = Math.round((grading.score / 100) * (question.points || 10));
          totalScore += questionScore;

          gradedAnswers.push({
            questionId: question.id,
            score: questionScore,
            maxScore: question.points || 10,
            userAnswer: answer.value,
            feedback: grading.feedback,
            keywords: grading.keywords,
          });
        } catch (gradingError) {
          console.error('AI Grading Error:', gradingError);
          gradedAnswers.push({
            questionId: question.id,
            score: 0,
            maxScore: question.points || 10,
            userAnswer: answer.value,
            error: 'Grading failed',
          });
        }
      }
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    await prisma.progress.upsert({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: chapterId,
        }
      },
      update: {
        completedAt: new Date(),
        masteryLevel: percentage,
        score: percentage,
        timeSpentSeconds: { increment: timeSpentSeconds || 0 },
        syncStatus: 'COMPLETED',
      },
      create: {
        userId: user.id,
        chapterId: chapterId,
        completedAt: new Date(),
        masteryLevel: percentage,
        score: percentage,
        timeSpentSeconds: timeSpentSeconds || 0,
        syncStatus: 'COMPLETED',
      }
    });

    if (percentage >= 70) {
      await prisma.chapter.update({
        where: { id: chapterId },
        data: { status: 'COMPLETED' }
      });
    }

    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        totalStudyMinutes: { increment: Math.ceil((timeSpentSeconds || 0) / 60) },
        totalPoints: { increment: percentage >= 70 ? 100 : 25 },
        testsCompleted: { increment: 1 },
        lastActiveAt: new Date(),
      }
    });

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    const currentMastery = profile?.averageMastery || 0;
    const testsCompleted = profile?.testsCompleted || 1;
    const newMastery = Math.round(((currentMastery * (testsCompleted - 1)) + percentage) / testsCompleted);

    await prisma.profile.update({
      where: { userId: user.id },
      data: { averageMastery: newMastery }
    });

    const duration = Date.now() - startTime;
    console.log(`[Assessment Submit] Success in ${duration}ms | Score: ${percentage}%`);

    return NextResponse.json({
      success: true,
      percentage,
      totalScore,
      maxScore,
      gradedAnswers,
      newMastery,
      pointsEarned: percentage >= 70 ? 100 : 25,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Assessment Submit] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to submit assessment.', details: error.message },
      { status: 500 }
    );
  }
}