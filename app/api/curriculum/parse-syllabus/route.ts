import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many file uploads. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse FormData
    const formData = await req.formData();
    const file = formData.get('syllabus') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    // Validate File Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, PNG, JPG, TXT.' },
        { status: 400 }
      );
    }

    // Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Convert to Base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // Generate with Gemini (Multimodal)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert academic curriculum architect. Read the attached syllabus document and extract the core subjects and their respective chapters/topics.

CRITICAL INSTRUCTION: You MUST return ONLY valid JSON. No markdown fences.

Required JSON Structure:
{
  "subjects": ["Subject Name 1", "Subject Name 2"],
  "chapters": [
    { "subject": "Subject Name 1", "topics": ["Chapter 1", "Chapter 2"] },
    { "subject": "Subject Name 2", "topics": ["Chapter 1", "Chapter 2"] }
  ]
}`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: file.type } },
    ]);

    const responseText = result.response.text();
    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const extracted = JSON.parse(cleanedText);

    if (!extracted.subjects || !Array.isArray(extracted.subjects)) {
      throw new Error('Invalid response format from AI');
    }

    const duration = Date.now() - startTime;
    console.log(`[Parse Syllabus] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      extracted,
      message: 'Syllabus document parsed successfully.',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Parse Syllabus] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to extract data from document.', details: error.message },
      { status: 500 }
    );
  }
}