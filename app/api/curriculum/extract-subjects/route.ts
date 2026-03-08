import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

// Output Schema
const subjectsSchema = z.object({
  subjects: z.array(z.string().describe('Name of the academic subject')),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse & Validate Input
    const { syllabusText } = await req.json();

    if (!syllabusText || syllabusText.length < 50) {
      return NextResponse.json({ success: true, subjects: [] });
    }

    // Generate Structured Output with AI SDK
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: 'You are a curriculum parser. Extract the core academic subjects from the provided raw syllabus text. Output broad categories like "Physics", "Computer Science", "History".',
      prompt: `Identify the main subjects in this text. Output only broad academic categories.\n\nSyllabus: ${syllabusText.substring(0, 25000)}`,
      schema: subjectsSchema,
    });

    const duration = Date.now() - startTime;
    console.log(`[Extract Subjects] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      subjects: object.subjects,
      message: 'Subjects extracted successfully.',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Extract Subjects] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to extract subjects.', details: error.message },
      { status: 500 }
    );
  }
}