import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

// Initialize Groq provider
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const subjectsSchema = z.object({
  subjects: z.array(z.string().describe('Name of the academic subject')),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { syllabusText } = await req.json();
    if (!syllabusText || syllabusText.length < 50) {
      return NextResponse.json({ success: true, subjects: [] });
    }

    // 🚀 Utilizing Groq 8B Instant for lightning-fast extraction
    const { object } = await generateObject({
      model: groq('llama-3.1-8b-instant'),
      providerOptions: {
        groq: {
          structuredOutputs: false,
          response_format: { type: 'json_object' },
        },
      },
      system: 'You are a curriculum parser. Extract the core academic subjects from the provided raw syllabus text. Output only a JSON object with a "subjects" array. Example: { "subjects": ["Physics", "Computer Science"] }',
      prompt: `Identify the main subjects in this text. Output only broad academic categories.\n\nSyllabus: ${syllabusText.substring(0, 25000)}`,
      schema: subjectsSchema,
      temperature: 0.1, // Low temperature ensures it doesn't hallucinate subjects
    });

    const duration = Date.now() - startTime;
    console.log(`[Extract Subjects] Success in ${duration}ms | Request: ${requestId} | Subjects: ${object.subjects.length}`);

    return NextResponse.json({
      success: true,
      subjects: object.subjects,
      message: 'Subjects extracted successfully.',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Extract Subjects] Error in ${duration}ms | Request: ${requestId}`, error);

    // Handle Zod schema errors gracefully
    if (error.name === 'TypeValidationError' || error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Failed to parse syllabus format.', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to extract subjects.', details: error.message },
      { status: 500 }
    );
  }
}