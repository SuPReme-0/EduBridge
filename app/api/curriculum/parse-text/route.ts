import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const parseTextSchema = z.object({
  syllabusText: z.string().min(50).max(50000),
});

// Schema matching the AI's natural nested output
const combinedSchema = z.object({
  subjects: z.array(
    z.object({
      name: z.string(),
      chapters: z.array(
        z.object({
          name: z.string(),
          topics: z.array(z.string()),
        })
      ),
    })
  ),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many parsing requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = parseTextSchema.parse(body);

    if (!validatedData.syllabusText || validatedData.syllabusText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Syllabus text too short. Please provide more detailed content.' },
        { status: 400 }
      );
    }

    const { object: extracted } = await generateObject({
      model: groq('llama-3.3-70b-versatile'),
      providerOptions: {
        groq: {
          structuredOutputs: false,
        },
      },
      system: 'You are an expert academic curriculum architect. Analyze the raw syllabus text and extract the core subjects and their respective chapters/topics. Return your answer in JSON format.',
      prompt: `Extract the detailed syllabus structure from this text. Return ONLY valid JSON:\n\n${validatedData.syllabusText.substring(0, 30000)}`,
      schema: combinedSchema,
      temperature: 0.1,
    });

    // ✅ Correct transformation: group chapter titles per subject
    const transformed = {
      subjects: extracted.subjects.map((s) => s.name),
      chapters: extracted.subjects.map((s) => ({
        subject: s.name,
        topics: s.chapters.map((c) => c.name), // chapter titles only
      })),
    };

    const duration = Date.now() - startTime;
    console.log(`[Parse Text] Success in ${duration}ms | Request: ${requestId} | Subjects: ${transformed.subjects.length}`);

    return NextResponse.json({
      success: true,
      extracted: transformed,
      message: 'Syllabus parsed successfully.',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Parse Text] Error in ${duration}ms | Request: ${requestId}`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data.', details: error.errors },
        { status: 400 }
      );
    }

    if (error.name === 'TypeValidationError') {
      return NextResponse.json(
        { error: 'AI failed to format the syllabus properly. Please try manual entry.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process syllabus text.', details: error.message },
      { status: 500 }
    );
  }
}