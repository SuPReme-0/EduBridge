import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier, recordTokenUsage } from '@/lib/rate-limit';
import crypto from 'crypto';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// ============================================================================
// 1. RETRY & TIMEOUT HELPERS
// ============================================================================
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 2000
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const isValidationError =
        error.name === 'TypeValidationError' ||
        error.name === 'ZodError' ||
        error?.statusCode === 400;

      if (isValidationError) {
        console.error('[ParseText] Fatal Schema Error.', error);
        throw error;
      }

      const isRetryable =
        error?.statusCode === 429 ||
        (error?.statusCode && error.statusCode >= 500) ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET';

      if (!isRetryable || attempt === retries) {
        throw error;
      }

      const waitMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000, 60000);
      console.warn(`[ParseText Retry] Attempt ${attempt}/${retries}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error('Unreachable');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    )
  ]);
}

// ============================================================================
// 2. SCHEMAS
// ============================================================================
const parseTextSchema = z.object({
  syllabusText: z.string().min(50),
  use70B: z.boolean().optional().default(false),
  classLevel: z.string().optional().default('10'),
  educationPath: z.enum(['school', 'diploma', 'bachelor', 'master']).optional().default('school'),
});

const chapterSchema = z.object({
  name: z.string(),
  topics: z.array(z.string()).optional().default([]),
}).passthrough();

const subjectSchema = z.object({
  name: z.string(),
  chapters: z.array(chapterSchema),
}).passthrough();

const combinedSchema = z.object({
  subjects: z.array(subjectSchema),
}).passthrough();

const consolidatedOutputSchema = z.object({
  subjects: z.array(subjectSchema),
}).passthrough();

// ============================================================================
// 3. DATA CLEANING HELPERS
// ============================================================================
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function cleanString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

function cleanTopics(topics: string[]): string[] {
  return topics
    .map(t => cleanString(toTitleCase(t)))
    .filter(Boolean);
}

// ============================================================================
// 4. HELPER: DETERMINE TARGET CHAPTERS PER SUBJECT (same as in parse-syllabus)
// ============================================================================
function getTargetChapters(classLevel: string | number, educationPath: string): number {
  const levelStr = String(classLevel);
  let year = 1;

  if (educationPath === 'school') {
    const grade = parseInt(levelStr, 10);
    if (!isNaN(grade) && grade >= 1 && grade <= 12) {
      year = grade;
    }
    return Math.floor(8 + (year - 1) * (22 / 11)); // 8..30
  }

  if (educationPath === 'diploma') {
    const match = levelStr.match(/\d+/);
    if (match) {
      year = parseInt(match[0], 10);
      if (year < 1) year = 1;
      if (year > 3) year = 3;
    }
    return 15 + (year - 1) * 5; // 15,20,25
  }

  if (educationPath === 'bachelor') {
    const match = levelStr.match(/\d+/);
    if (match) {
      year = parseInt(match[0], 10);
      if (year < 1) year = 1;
      if (year > 4) year = 4;
    }
    return 20 + (year - 1) * 5; // 20,25,30,35
  }

  if (educationPath === 'master') {
    const match = levelStr.match(/\d+/);
    if (match) {
      year = parseInt(match[0], 10);
      if (year < 1) year = 1;
      if (year > 2) year = 2;
    }
    return 25 + (year - 1) * 5; // 25,30
  }

  return 20; // fallback
}

// ============================================================================
// 5. CONSOLIDATION FUNCTION (AI‑based refinement with target chapter count)
// ============================================================================
async function consolidateCurriculum(
  rawSubjects: Array<{ name: string; chapters: Array<{ name: string; topics: string[] }> }>,
  userId: string,
  classLevel: string,
  educationPath: string
): Promise<Array<{ name: string; chapters: Array<{ name: string; topics: string[] }> }>> {
  console.log(`[ParseText] Consolidating ${rawSubjects.length} raw subjects for ${educationPath} ${classLevel}`);

  if (rawSubjects.length === 0) return [];

  const targetChapters = getTargetChapters(classLevel, educationPath);
  const minChapters = Math.max(5, Math.floor(targetChapters * 0.7));
  const maxChapters = Math.min(35, Math.ceil(targetChapters * 1.3));

  const prompt = `You are an expert curriculum architect. Below is a raw extraction of subjects, chapters, and topics from a syllabus document. The data may be messy, contain duplicates, or have subjects that should be merged. Your task is to restructure this into a clean, well‑organized curriculum suitable for a student in **${educationPath}** at level **${classLevel}**.

**Requirements:**
- Group related subjects under a single, clear subject name (e.g., combine "Advanced Programming (OOP)" and "Computer Science" into "Computer Science").
- **Each subject should have approximately ${minChapters} to ${maxChapters} chapters** (aim for around ${targetChapters}).
- If a subject has too few chapters, consider merging it with a related subject or expanding it using topics from other subjects.
- Remove duplicate chapters and redundant topics.
- For each chapter, keep its name and list of topics.
- The output must be a JSON object with a "subjects" array, each subject having "name" and "chapters" (each chapter has "name" and "topics").

Here is the raw extracted data:
${JSON.stringify(rawSubjects, null, 2)}

Return ONLY the cleaned JSON. Do not include any explanation.`;

  try {
    const { object: consolidated, usage } = await withRetry(async () => {
      return await withTimeout(
        generateObject({
          model: groq('llama-3.3-70b-versatile'),
          providerOptions: {
            groq: {
              structuredOutputs: false,
              response_format: { type: 'json_object' },
            },
          },
          system: 'You are a curriculum consolidation expert. Restructure the given raw syllabus data into a clean, well‑organized curriculum.',
          prompt,
          schema: consolidatedOutputSchema,
          temperature: 0.2,
        }),
        60000
      );
    }, 2, 2000);

    if (usage?.totalTokens) {
      await recordTokenUsage(userId, usage.totalTokens);
    }

    if (!consolidated.subjects || consolidated.subjects.length === 0) {
      console.warn('[ParseText] Consolidation returned no subjects, using raw data');
      return rawSubjects;
    }

    console.log(`[ParseText] Consolidation successful: ${consolidated.subjects.length} subjects`);
    return consolidated.subjects;
  } catch (error) {
    console.error('[ParseText] Consolidation failed, using raw subjects:', error);
    return rawSubjects; // fallback
  }
}

// ============================================================================
// 6. MAIN HANDLER
// ============================================================================
export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // --- Rate limiting ---
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many parsing requests. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': rateLimit.reset.toString() } }
      );
    }

    // --- Authentication ---
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Content type check ---
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      );
    }

    // --- Parse input (now includes classLevel and educationPath) ---
    const body = await req.json();
    const validatedData = parseTextSchema.parse(body);
    const rawText = validatedData.syllabusText.trim();
    if (rawText.length < 50) {
      return NextResponse.json(
        { error: 'Syllabus text too short. Please provide more detailed content.' },
        { status: 400 }
      );
    }

    const { classLevel, educationPath, use70B } = validatedData;

    // --- Model selection and safe truncation ---
    const use70Bfinal = use70B || rawText.length > 20000;
    const extractionModel = use70Bfinal ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
    const maxChars = use70Bfinal ? 40000 : 20000;
    const truncatedText = rawText.length > maxChars
      ? rawText.substring(0, maxChars) + '... [truncated]'
      : rawText;

    // --- EXTRACTION: first pass to get raw subjects/chapters ---
    console.log(`[ParseText] Extracting with ${extractionModel}`);
    const { object: extracted, usage } = await withRetry(async () => {
      return await withTimeout(
        generateObject({
          model: groq(extractionModel),
          providerOptions: {
            groq: {
              structuredOutputs: false,
              response_format: { type: 'json_object' },
            },
          },
          system: 'You are an expert curriculum parser. Extract subjects, chapters, and topics exactly as they appear. Do not invent content. Output JSON with a "subjects" array, each subject having a "name" and a "chapters" array. Each chapter must have a "name" and a "topics" array (list of key topics).',
          prompt: `Extract the detailed syllabus structure from this text. Return ONLY valid JSON with a "subjects" array. Each subject should have a "name" and a "chapters" array. Each chapter should have a "name" and a "topics" array (list of key topics).\n\n${truncatedText}`,
          schema: combinedSchema,
          temperature: 0.1,
        }),
        60000
      );
    }, 3, 2000);

    if (usage?.totalTokens) {
      await recordTokenUsage(user.id, usage.totalTokens);
    }

    if (!extracted.subjects || extracted.subjects.length === 0) {
      throw new Error('No subjects found in syllabus text. Please provide more structured content.');
    }

    // --- CONSOLIDATION (if enough subjects) ---
    let finalSubjects = extracted.subjects;
    if (extracted.subjects.length >= 3) {
      finalSubjects = await consolidateCurriculum(extracted.subjects, user.id, classLevel, educationPath);
    }

    // --- Transform to frontend-friendly format (flat chapters) ---
    const flatChapters: Array<{ subject: string; topics: string[] }> = [];

    for (const s of finalSubjects) {
      if (!s || typeof s !== 'object') continue;
      const subjectName = cleanString(toTitleCase(s.name || 'Unknown Subject'));
      const chapterList = Array.isArray(s.chapters) ? s.chapters : [];

      for (const c of chapterList) {
        if (!c || typeof c !== 'object') continue;
        const topics = cleanTopics(Array.isArray(c.topics) ? c.topics : []);
        flatChapters.push({ subject: subjectName, topics });
      }
    }

    flatChapters.sort((a, b) => a.subject.localeCompare(b.subject));

    const transformed = {
      subjects: Array.from(new Set(flatChapters.map(c => c.subject))),
      chapters: flatChapters,
    };

    const duration = Date.now() - startTime;
    console.log(`[ParseText] Success in ${duration}ms | Request: ${requestId} | Subjects: ${transformed.subjects.length} | Consolidated: ${finalSubjects !== extracted.subjects}`);

    return NextResponse.json({
      success: true,
      extracted: transformed,
      message: rawText.length > maxChars
        ? 'Syllabus parsed successfully (some content truncated).'
        : 'Syllabus parsed successfully.',
      modelUsed: extractionModel,
      consolidated: finalSubjects !== extracted.subjects,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[ParseText] Error in ${duration}ms | Request: ${requestId}`, error);

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