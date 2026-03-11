import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier, recordTokenUsage } from '@/lib/rate-limit';
import { z } from 'zod';
import crypto from 'crypto';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const recommendBooksSchema = z.object({
  educationPath: z.enum(['school', 'diploma', 'bachelor', 'master']).default('school'),
  classLevel: z.string(),
  board: z.string().optional().default(''),
  school: z.string().optional().default(''),
  subjects: z.array(z.string()).min(1, 'At least one subject is required'),
  chapters: z.array(z.string()).optional(),
});

const bookSchema = z.object({
  title: z.string(),
  author: z.string(),
  publisher: z.string().nullable(),
  coverageScore: z.number().min(0).max(100),
}).passthrough();

const recommendationsSchema = z.object({
  recommendations: z.array(
    z.object({
      subject: z.string(),
      books: z.array(bookSchema).max(5),
    })
  ),
});

function summarizeChapters(chapters: string[] = [], maxLength = 500): string {
  if (chapters.length === 0) return 'General curriculum topics';
  let summary = chapters.slice(0, 10).join(', ');
  if (chapters.length > 10) summary += ` and ${chapters.length - 10} more chapters`;
  return summary.length > maxLength ? summary.substring(0, maxLength) + '…' : summary;
}

function getNumericLevel(educationPath: string, classLevel: string): number {
  if (educationPath === 'school') {
    const grade = parseInt(classLevel, 10);
    return isNaN(grade) ? 10 : grade;
  }
  const match = classLevel.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return 1;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  console.log(`\n📘 [Book Recommender] START Request ${requestId}`);

  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait.' },
        { status: 429, headers: { 'Retry-After': rateLimit.reset.toString() } }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = recommendBooksSchema.parse(body);
    const { educationPath, classLevel, board, school, subjects, chapters } = validatedData;

    // Build human‑readable level description
    let levelDisplay = '';
    if (educationPath === 'school') {
      const grade = parseInt(classLevel, 10);
      levelDisplay = `Grade ${isNaN(grade) ? classLevel : grade}`;
    } else if (educationPath === 'diploma') {
      const year = classLevel.replace('diploma-', '');
      levelDisplay = `Diploma Year ${year}`;
    } else if (educationPath === 'bachelor') {
      const year = classLevel.replace('bachelor-', '');
      levelDisplay = `Bachelor's Year ${year}`;
    } else if (educationPath === 'master') {
      const year = classLevel.replace('master-', '');
      levelDisplay = `Master's Year ${year}`;
    }

    const numericLevel = getNumericLevel(educationPath, classLevel);
    const chapterSummary = summarizeChapters(chapters, 800);

    // Model selection (use 70B for complex cases)
    const use70B = subjects.length > 5 ||
                   ['ib', 'igcse', 'advanced'].some(b => board.toLowerCase().includes(b)) ||
                   school.length > 0;
    const modelName = use70B ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

    console.log(`[Book Recommender] Using ${modelName} for ${subjects.length} subjects, ${levelDisplay} at ${school || 'unknown institution'}`);

    const institutionContext = school ? `They are studying at **${school}**. ` : '';

    const { object: raw, usage } = await generateObject({
      model: groq(modelName), // ✅ Use the dynamically selected model
      providerOptions: {
        groq: {
          structuredOutputs: false,
          response_format: { type: 'json_object' },
        },
      },
      system: `You are an expert curriculum auditor for the ${board || 'generic'} board. The student is in a **${educationPath}** program (${levelDisplay}). Return your answer in valid JSON format.`,
      prompt: `A student in **${levelDisplay}** (${educationPath} path) needs authoritative textbooks that exactly match their syllabus for the following subjects: ${subjects.join(', ')}.
${institutionContext}They will study topics including: ${chapterSummary}

**IMPORTANT:** The student is in a **${educationPath}** program, NOT a diploma or ITI. Recommend textbooks appropriate for university/college level ${educationPath} students. Do NOT recommend books meant for vocational or ITI courses.

For EACH subject, recommend up to 5 textbooks that are:
- Specifically written for the **${board || 'generic'}** board, **${levelDisplay}** level.
- Contain at least 80% of the listed topics for that subject.
- Widely used in institutions following this board.
- If possible, consider textbooks commonly used at **${school || 'similar institutions'}**.

For each book, provide: title, author, publisher (or null if unknown), and coverageScore (percentage 0-100). Do not include any extra fields. Return a JSON object with exactly this structure:
{
  "recommendations": [
    {
      "subject": "Subject Name",
      "books": [
        {
          "title": "Exact book title with edition",
          "author": "Author name(s)",
          "publisher": "Publisher name",
          "coverageScore": 95
        }
      ]
    }
  ]
}`,
      schema: recommendationsSchema,
      temperature: 0.3,
    });

    if (usage?.totalTokens) {
      await recordTokenUsage(user.id, usage.totalTokens);
    }

    // Prepare response (no database saving to avoid polluting with wrong-path books)
    const recommendations = raw.recommendations.map(rec => ({
      subject: rec.subject,
      books: rec.books.map(book => ({
        ...book,
        // Ensure subject fallback
        subject: book.subject || rec.subject || 'General Reference',
      })),
    }));

    const duration = Date.now() - startTime;
    console.log(`✅ [Book Recommender] Success in ${duration}ms, returned ${recommendations.length} subjects using ${modelName}`);

    return NextResponse.json({
      success: true,
      recommendations,
      modelUsed: modelName,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Book Recommender] Error in ${duration}ms:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'AI returned an unexpected structure. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate book recommendations.' },
      { status: 500 }
    );
  }
}