import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { z } from 'zod';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Validation schema – subjects are now expected to be an array of subject names (strings)
const recommendBooksSchema = z.object({
  educationPath: z.string().default('School'),
  classLevel: z.coerce.number().min(1).max(12),
  board: z.string().min(1).default(''),
  subjects: z.array(z.string()).min(1, 'At least one subject is required'),
  chapters: z.array(z.string()).optional(), // chapter titles from parsed syllabus
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  console.log(`\n📘 [Book Recommender] START Request ${requestId}`);

  try {
    // 1. Rate limiting
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);
    if (!rateLimit.success) {
      console.warn(`[Book Recommender] Rate limited: ${clientIp}`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait.' },
        { status: 429 }
      );
    }

    // 2. Authentication
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error(`[Book Recommender] Unauthorized`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse and validate request body
    const body = await req.json();
    console.log(`[Book Recommender] Payload received:`, body);
    const validatedData = recommendBooksSchema.parse(body);

    // Prepare chapter context (max 20 chapters to avoid token overflow)
    const chapterContext = validatedData.chapters?.slice(0, 20).join(', ') || 'General curriculum topics';

    // 4. Build AI prompt – now asks for recommendations per subject
    const prompt = `Act as an expert curriculum auditor for the **${validatedData.board}** board.

A student in Grade **${validatedData.classLevel}** needs authoritative textbooks that exactly match their syllabus for the following subjects: ${validatedData.subjects.join(', ')}.

They will be studying the following chapters/topics (sample):
${chapterContext}

For **each subject**, recommend **up to 3 textbooks** that are:
- Specifically written for **${validatedData.board}** Grade **${validatedData.classLevel}**.
- Contain at least 80% of the listed chapters for that subject in their table of contents.
- Widely used in schools following this board.

For each book, provide the **coverageScore** (percentage of provided chapters that appear in the book for that subject).

Return **ONLY valid JSON** in this exact format (no markdown, no code fences):
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
}`;

    // 5. Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean AI response (remove markdown fences)
    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      throw new Error('Invalid AI response structure: missing recommendations array');
    }

    // 6. Save books to database (avoid duplicates) and build response
    const savedRecommendations = [];

    for (const rec of parsed.recommendations) {
      const subjectName = rec.subject;
      const booksForSubject = rec.books || [];

      const savedBooksForSubject = [];

      for (const book of booksForSubject.slice(0, 3)) { // ensure at most 3 per subject
        // Check if book already exists for this class/board
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
              subjectCategory: subjectName, // store the subject name
              coverUrl: null,
            },
          });
        }
        savedBooksForSubject.push({
          ...existing,
          coverageScore: book.coverageScore, // include score in response
        });
      }

      savedRecommendations.push({
        subject: subjectName,
        books: savedBooksForSubject,
      });
    }

    console.log(`✅ [Book Recommender] Success for user ${user.id}, returned recommendations for ${savedRecommendations.length} subjects`);

    // 7. Return the structured recommendations
    return NextResponse.json({
      success: true,
      recommendations: savedRecommendations,
    });
  } catch (error: any) {
    console.error(`❌ [Book Recommender] Error:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof SyntaxError) {
      // Likely JSON parse error from AI response
      console.error('AI response parsing failed:', error.message);
      return NextResponse.json(
        { error: 'AI returned malformed JSON. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate book recommendations.' },
      { status: 500 }
    );
  }
}