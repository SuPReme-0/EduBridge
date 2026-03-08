import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import pdfParse from 'pdf-parse';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Combined schema matching AI's natural nested output
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
        { error: 'Too many file uploads. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('syllabus') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, PNG, JPG, TXT.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = '';
    let isImage = false;

    if (file.type === 'text/plain') {
      extractedText = buffer.toString('utf-8');
    } else if (file.type === 'application/pdf') {
      try {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
      } catch (err) {
        console.error("PDF Parsing Error:", err);
        return NextResponse.json({ error: 'Failed to read PDF text. Is it a scanned image?' }, { status: 400 });
      }
    } else if (file.type.startsWith('image/')) {
      isImage = true;
    }

    // Select model based on input type
    const modelId = isImage 
      ? 'llama-3.2-90b-vision-preview' 
      : 'llama-3.3-70b-versatile'; // updated from deprecated 3.1

    // Prepare messages for Groq
    const messages: any = [];

    if (isImage) {
      // Convert image buffer to base64 data URL
      const base64Image = buffer.toString('base64');
      const mimeType = file.type; // e.g., 'image/jpeg'
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this syllabus image and extract the core subjects and their chapters/topics. Return ONLY valid JSON.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: `Analyze this syllabus text and extract the core subjects and their chapters/topics. Return ONLY valid JSON:\n\n${extractedText.substring(0, 30000)}`,
      });
    }

    // Generate structured output with Groq
    const { object: extracted } = await generateObject({
      model: groq(modelId),
      providerOptions: {
        groq: {
          structuredOutputs: false,
          response_format: { type: 'json_object' },
        },
      },
      system: 'You are an expert academic curriculum architect. Extract subjects, chapters, and topics accurately from the provided material. Return JSON with the structure: { "subjects": [{ "name": string, "chapters": [{ "name": string, "topics": string[] }] }] }',
      messages,
      schema: combinedSchema,
      temperature: 0.1,
    });

    // Transform to the flat format expected by the frontend
    const transformed = {
      subjects: extracted.subjects.map((s) => s.name),
      chapters: extracted.subjects.flatMap((s) =>
        s.chapters.map((c) => ({
          subject: s.name,
          topics: c.topics, // keep topics as array for later use
        }))
      ),
    };

    const duration = Date.now() - startTime;
    console.log(`[Parse Syllabus] Success in ${duration}ms | Request: ${requestId} | Subjects: ${transformed.subjects.length}`);

    return NextResponse.json({
      success: true,
      extracted: transformed,
      message: 'Syllabus document parsed successfully.',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Parse Syllabus] Error in ${duration}ms | Request: ${requestId}`, error);

    if (error.name === 'TypeValidationError' || error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'AI failed to format the syllabus properly. Please try manual entry.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to extract data from document.', details: error.message },
      { status: 500 }
    );
  }
}