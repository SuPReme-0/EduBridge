import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { z } from 'zod';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Validation Schema
const parseTextSchema = z.object({
  syllabusText: z.string().min(50).max(50000),
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
        { error: 'Too many parsing requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate Input
    const body = await req.json();
    const validatedData = parseTextSchema.parse(body);

    if (!validatedData.syllabusText || validatedData.syllabusText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Syllabus text too short. Please provide more detailed content.' },
        { status: 400 }
      );
    }

    // Generate with Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert academic curriculum architect. Analyze the following raw syllabus text and extract the core subjects and their respective chapters/topics.

CRITICAL INSTRUCTION: You MUST return ONLY valid JSON. No markdown fences, no conversational text.

Required JSON Structure:
{
  "subjects": ["Subject 1 Name", "Subject 2 Name"],
  "chapters": [
    {
      "subject": "Subject 1 Name",
      "topics": ["Chapter 1 Name", "Chapter 2 Name"]
    }
  ]
}

Raw Syllabus Text:
${validatedData.syllabusText.substring(0, 45000)}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean potential markdown fences
    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const extracted = JSON.parse(cleanedText);

    if (!extracted.subjects || !Array.isArray(extracted.subjects)) {
      throw new Error('Invalid response format from AI');
    }

    const duration = Date.now() - startTime;
    console.log(`[Parse Text] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      extracted,
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

    return NextResponse.json(
      { error: 'Failed to process syllabus text.', details: error.message },
      { status: 500 }
    );
  }
}