import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { z } from 'zod';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const recommendBooksSchema = z.object({
  educationPath: z.string().default('School'),
  classLevel: z.coerce.number().min(1).max(12),
  board: z.string().min(1).default(''),
  subjects: z.array(z.string()).min(1, 'At least one subject is required'),
  chapters: z.array(z.string()).optional(),
});

// Schema that matches the frontend's expected structure
// Use .passthrough() on book to allow extra fields (like containsChapters) without failing
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
      books: z.array(bookSchema).max(3),
    })
  ),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  console.log(`\n📘 [Book Recommender] START Request ${requestId}`);

  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);
    if (!rateLimit.success) {
      console.warn(`[Book Recommender] Rate limited: ${clientIp}`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait.' },
        { status: 429 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error(`[Book Recommender] Unauthorized`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log(`[Book Recommender] Payload received:`, body);
    const validatedData = recommendBooksSchema.parse(body);

    const chapterContext = validatedData.chapters?.slice(0, 20).join(', ') || 'General curriculum topics';

    // Try primary model first, fallback to faster/cheaper model if needed
    let raw;
    try {
      const result = await generateObject({
        model: groq('llama-3.3-70b-versatile'),
        providerOptions: {
          groq: {
            structuredOutputs: false,
            response_format: { type: 'json_object' },
          },
        },
        system: `You are an expert curriculum auditor for the ${validatedData.board} board. Return your answer in valid JSON format.`,
        prompt: `A student in Grade ${validatedData.classLevel} needs authoritative textbooks that exactly match their syllabus for the following subjects: ${validatedData.subjects.join(', ')}.

They will be studying the following chapters/topics (sample):
${chapterContext}

For EACH subject, recommend up to 3 textbooks that are:
- Specifically written for the ${validatedData.board} board, Grade ${validatedData.classLevel}.
- Contain at least 80% of the listed chapters for that subject.
- Widely used in schools following this board.

For each book, provide: title, author, publisher (or null if unknown), and coverageScore (percentage 0-100). Do not include any extra fields like "containsChapters". Return a JSON object with exactly this structure:
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
        temperature: 0.4,
      });
      raw = result.object;
    } catch (primaryError) {
      console.warn(`[Book Recommender] Primary model failed, falling back to 8B model`, primaryError);
      const fallbackResult = await generateObject({
        model: groq('llama-3.1-8b-instant'),
        providerOptions: {
          groq: {
            structuredOutputs: false,
            response_format: { type: 'json_object' },
          },
        },
        system: `You are an expert curriculum auditor for the ${validatedData.board} board. Return your answer in valid JSON format.`,
        prompt: `A student in Grade ${validatedData.classLevel} needs textbooks for subjects: ${validatedData.subjects.join(', ')}.
        Sample chapters: ${chapterContext}
        Recommend up to 3 books per subject with title, author, publisher, coverageScore. Return JSON with recommendations array.`,
        schema: recommendationsSchema,
        temperature: 0.4,
      });
      raw = fallbackResult.object;
    }

    // Transform to include coverageScore in saved books
    const savedRecommendations = [];

    for (const rec of raw.recommendations) {
      const subjectName = rec.subject;
      const booksForSubject = rec.books || [];

      const addedTitles = new Set();
      const savedBooksForSubject = [];

      for (const book of booksForSubject) {
        if (savedBooksForSubject.length >= 3) break;
        if (addedTitles.has(book.title)) continue;

        let existing = await prisma.book.findFirst({
          where: {
            title: book.title,
            classLevel: validatedData.classLevel,
            board: validatedData.board,
          },
        });

        if (!existing) {
          existing = await prisma.book.create({
            data: {
              title: book.title,
              author: book.author || 'Unknown',
              publisher: book.publisher || null,
              classLevel: validatedData.classLevel,
              board: validatedData.board,
              subjectCategory: subjectName,
              coverUrl: null,
            },
          });
        }

        savedBooksForSubject.push({
          ...existing,
          coverageScore: book.coverageScore,
        });
        addedTitles.add(book.title);
      }

      savedRecommendations.push({
        subject: subjectName,
        books: savedBooksForSubject,
      });
    }

    console.log(`✅ [Book Recommender] Success for user ${user.id}, returned recommendations for ${savedRecommendations.length} subjects`);

    return NextResponse.json({
      success: true,
      recommendations: savedRecommendations,
    });

  } catch (error: any) {
    console.error(`❌ [Book Recommender] Error:`, error);

    if (error instanceof z.ZodError) {
      console.error('Zod validation error details:', JSON.stringify(error.errors, null, 2));
      return NextResponse.json(
        { error: 'AI returned an unexpected structure. Please try again.' },
        { status: 500 }
      );
    }

    if (error.name === 'TypeValidationError') {
      return NextResponse.json(
        { error: 'AI failed to format the recommendations properly.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate book recommendations.' },
      { status: 500 }
    );
  }
}