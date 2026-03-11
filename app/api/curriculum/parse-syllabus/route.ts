import { NextResponse } from 'next/server';
import { generateObject, ModelMessage } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier, recordTokenUsage } from '@/lib/rate-limit';
import pdfParse from 'pdf-parse';
import crypto from 'crypto';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// ============================================================================
// 1. HELPER: RETRY & TIMEOUT
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
        console.error('[SyllabusParser] Fatal Schema Error.', error);
        throw error;
      }

      if (error?.statusCode === 413) {
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
      console.warn(`[SyllabusParser Retry] Attempt ${attempt}/${retries}. Retrying in ${Math.round(waitMs / 1000)}s...`);
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
// 2. CONFIGURATION
// ============================================================================
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Safe chunk size: 3000 tokens ≈ 12,000 characters
const CHUNK_SIZE_CHARS = 12000;

// Models
const TEXT_EXTRACTION_MODEL = 'llama-3.1-8b-instant';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const CONSOLIDATION_MODEL = 'llama-3.3-70b-versatile'; // more powerful for final structuring

// ============================================================================
// 3. SCHEMAS (including topics)
// ============================================================================
const chapterWithTopicsSchema = z.object({
  name: z.string(),
  topics: z.array(z.string()).optional().default([]),
});

const subjectWithChaptersSchema = z.object({
  name: z.string(),
  chapters: z.array(chapterWithTopicsSchema),
});

const chunkOutputSchema = z.object({
  subjects: z.array(subjectWithChaptersSchema),
}).passthrough();

// Same schema for consolidation output
const consolidatedOutputSchema = z.object({
  subjects: z.array(subjectWithChaptersSchema),
}).passthrough();

// ============================================================================
// 4. HELPER: SPLIT TEXT INTO CHUNKS
// ============================================================================
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const nextNewline = text.indexOf('\n', end);
      if (nextNewline !== -1 && nextNewline - end < 1000) {
        end = nextNewline + 1;
      } else {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start + maxChars * 0.8) {
          end = lastSpace;
        }
      }
    }
    chunks.push(text.substring(start, end).trim());
    start = end;
  }
  return chunks.filter(c => c.length > 0);
}

// ============================================================================
// 5. HELPER: MERGE SUBJECTS FROM MULTIPLE CHUNKS
// ============================================================================
type Chapter = { name: string; topics: string[] };
type Subject = { name: string; chapters: Chapter[] };

function mergeSubjects(subjectLists: Subject[][]): Subject[] {
  const subjectMap = new Map<string, Map<string, Set<string>>>();

  for (const list of subjectLists) {
    for (const subj of list) {
      if (!subjectMap.has(subj.name)) {
        subjectMap.set(subj.name, new Map());
      }
      const chapterMap = subjectMap.get(subj.name)!;
      for (const ch of subj.chapters) {
        if (!chapterMap.has(ch.name)) {
          chapterMap.set(ch.name, new Set());
        }
        const topicSet = chapterMap.get(ch.name)!;
        for (const topic of ch.topics) {
          topicSet.add(topic);
        }
      }
    }
  }

  return Array.from(subjectMap.entries()).map(([subjName, chapterMap]) => ({
    name: subjName,
    chapters: Array.from(chapterMap.entries()).map(([chName, topics]) => ({
      name: chName,
      topics: Array.from(topics),
    })),
  }));
}

// ============================================================================
// 6. CONSOLIDATION FUNCTION (AI‑based refinement)
// ============================================================================
async function consolidateCurriculum(
  rawSubjects: Subject[],
  userId: string
): Promise<Subject[]> {
  console.log(`[Consolidate] Starting consolidation of ${rawSubjects.length} raw subjects`);

  // Prepare a compact representation of raw subjects for the prompt
  const rawData = rawSubjects.map(s => ({
    name: s.name,
    chapters: s.chapters.map(c => ({
      name: c.name,
      topics: c.topics,
    })),
  }));

  const prompt = `You are an expert curriculum architect. Below is a raw extraction of subjects, chapters, and topics from a syllabus document. The data may be messy, contain duplicates, or have subjects that should be merged (e.g., "Advanced Programming (OOP)" and "Computer Science" might belong together). Your task is to restructure this into a clean, well-organized curriculum.

Requirements:
- Group related subjects under a single, clear subject name (e.g., combine "Advanced Programming (OOP)" and "Computer Science" into "Computer Science" if appropriate).
- Ensure each subject has a reasonable number of chapters (typically 5–15). If a subject has too few chapters, consider merging with a related subject or expanding with topics from other subjects.
- For each chapter, keep its name and list of topics. Remove duplicate chapters/topics.
- The output should be a JSON object with a "subjects" array, each subject having "name" and "chapters" (each chapter has "name" and "topics").

Here is the raw extracted data:
${JSON.stringify(rawData, null, 2)}

Return ONLY the cleaned JSON. Do not include any explanation.`;

  try {
    const { object: consolidated, usage } = await withRetry(async () => {
      return await withTimeout(
        generateObject({
          model: groq(CONSOLIDATION_MODEL),
          providerOptions: {
            groq: {
              structuredOutputs: false,
              response_format: { type: 'json_object' },
            },
          },
          system: 'You are a curriculum consolidation expert. Restructure the given raw syllabus data into a clean, well-organized curriculum.',
          prompt,
          schema: consolidatedOutputSchema,
          temperature: 0.2, // low temp for deterministic grouping
        }),
        60000
      );
    }, 2, 2000);

    if (usage?.totalTokens) {
      await recordTokenUsage(userId, usage.totalTokens);
    }

    if (!consolidated.subjects || consolidated.subjects.length === 0) {
      throw new Error('Consolidation returned no subjects');
    }

    console.log(`[Consolidate] Success: ${consolidated.subjects.length} subjects after consolidation`);
    return consolidated.subjects;
  } catch (error) {
    console.error('[Consolidate] Failed, using raw subjects:', error);
    return rawSubjects; // fallback
  }
}

// ============================================================================
// 7. MAIN HANDLER
// ============================================================================
export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // --- Rate limiting & auth ---
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileWrite, clientIp);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many file uploads. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': rateLimit.reset.toString() } }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Verify content type is multipart/form-data ---
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data for file uploads' },
        { status: 415 }
      );
    }

    // --- Parse form data ---
    const formData = await req.formData();
    const file = formData.get('syllabus') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, PNG, JPG, TXT.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // --- Read file content ---
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
        if (!extractedText || extractedText.trim().length < 100) {
          return NextResponse.json(
            { error: 'The PDF appears to be scanned (image-based). Please upload images of each page instead.' },
            { status: 400 }
          );
        }
      } catch (err) {
        console.error('PDF Parsing Error:', err);
        return NextResponse.json(
          { error: 'Failed to read PDF text. Ensure it is not corrupted or password-protected.' },
          { status: 400 }
        );
      }
    } else if (file.type.startsWith('image/')) {
      isImage = true;
    }

    if (!isImage && !extractedText.trim()) {
      return NextResponse.json(
        { error: 'The uploaded file contains no extractable text.' },
        { status: 400 }
      );
    }

    // ============================================================================
    // 8. PROCESS BASED ON TYPE
    // ============================================================================
    let finalSubjects: Subject[] = [];
    let chunksProcessed = 0;
    let totalTokensUsed = 0;

    if (isImage) {
      // --- Vision model ---
      console.log(`[SyllabusParser] Processing single image with ${VISION_MODEL}`);
      const base64Image = buffer.toString('base64');
      const mimeType = file.type;
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const messages: ModelMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all academic subjects, their chapters, and any topics mentioned from this syllabus page. Return ONLY JSON with structure: { "subjects": [{ "name": string, "chapters": [{ "name": string, "topics": string[] }] }] }' },
            { type: 'image', image: dataUrl },
          ],
        },
      ];

      try {
        const result = await withRetry(async () => {
          return await withTimeout(
            generateObject({
              model: groq(VISION_MODEL),
              providerOptions: {
                groq: {
                  structuredOutputs: false,
                  response_format: { type: 'json_object' },
                },
              },
              system: 'You are a precise curriculum parser. Extract every subject, chapter, and topic visible on the page.',
              messages,
              schema: chunkOutputSchema,
              temperature: 0.1,
            }),
            60000
          );
        }, 2, 2000);

        if (result.object.subjects?.length) {
          finalSubjects = result.object.subjects;
        }
        if (result.usage?.totalTokens) totalTokensUsed += result.usage.totalTokens;
        chunksProcessed = 1;
      } catch (error) {
        console.error('[SyllabusParser] Vision model failed:', error);
        return NextResponse.json(
          { error: 'Failed to extract from image. Please ensure the image is clear and contains syllabus text.' },
          { status: 500 }
        );
      }
    } else {
      // --- Text-based: split into chunks ---
      const chunks = splitTextIntoChunks(extractedText, CHUNK_SIZE_CHARS);
      console.log(`[SyllabusParser] Split text into ${chunks.length} chunks (max ${CHUNK_SIZE_CHARS} chars)`);

      const chunkResults: Subject[][] = [];

      for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i];
        console.log(`[SyllabusParser] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);

        let attempt = 0;
        const maxAttempts = 3;
        let success = false;

        while (attempt < maxAttempts && !success) {
          const messages: ModelMessage[] = [
            {
              role: 'user',
              content: `Extract all academic subjects, their chapters, and any topics mentioned from this syllabus excerpt. Return ONLY JSON with structure: { "subjects": [{ "name": string, "chapters": [{ "name": string, "topics": string[] }] }] }\n\nExcerpt:\n${chunk}`,
            },
          ];

          try {
            const result = await withRetry(async () => {
              return await withTimeout(
                generateObject({
                  model: groq(TEXT_EXTRACTION_MODEL),
                  providerOptions: {
                    groq: {
                      structuredOutputs: false,
                      response_format: { type: 'json_object' },
                    },
                  },
                  system: 'You are a precise curriculum parser. Extract every subject, chapter, and topic mentioned in the text. Do not invent anything.',
                  messages,
                  schema: chunkOutputSchema,
                  temperature: 0.1,
                }),
                45000
              );
            }, 2, 2000);

            if (result.object.subjects?.length) {
              chunkResults.push(result.object.subjects);
            } else {
              chunkResults.push([]);
            }
            if (result.usage?.totalTokens) totalTokensUsed += result.usage.totalTokens;
            chunksProcessed++;
            success = true;
          } catch (error: any) {
            if (error?.statusCode === 413 && chunk.length > 2000) {
              const newLength = Math.floor(chunk.length * 0.7);
              chunk = chunk.substring(0, newLength) + '... [truncated]';
              attempt++;
              console.warn(`[SyllabusParser] Chunk ${i + 1} too large, truncating to ${newLength} chars and retrying (attempt ${attempt})`);
            } else {
              console.error(`[SyllabusParser] Chunk ${i + 1} failed:`, error);
              chunkResults.push([]);
              chunksProcessed++;
              success = true;
            }
          }
        }
      }

      // Merge all chunk results
      const mergedSubjects = mergeSubjects(chunkResults);
      console.log(`[SyllabusParser] Merged into ${mergedSubjects.length} raw subjects`);

      // --- 9. CONSOLIDATE using AI ---
      finalSubjects = await consolidateCurriculum(mergedSubjects, user.id);
    }

    // ============================================================================
    // 10. TRANSFORM TO FRONTEND-FRIENDLY FORMAT (NO CHAPTER NAMES)
    // ============================================================================
    const transformed = {
      subjects: finalSubjects.map(s => s.name),
      chapters: finalSubjects.flatMap(s =>
        s.chapters.map(ch => ({
          subject: s.name,
          topics: ch.topics || [],
        }))
      ),
    };

    // ============================================================================
    // 11. RECORD TOKEN USAGE & RETURN
    // ============================================================================
    const duration = Date.now() - startTime;
    console.log(`[SyllabusParser] Success in ${duration}ms | Request: ${requestId} | Subjects: ${transformed.subjects.length} | Chunks: ${chunksProcessed} | Tokens: ${totalTokensUsed}`);

    return NextResponse.json({
      success: true,
      extracted: transformed,
      message: chunksProcessed > 1
        ? `Syllabus parsed and consolidated from ${chunksProcessed} sections.`
        : 'Syllabus parsed successfully.',
      chunksProcessed,
      modelUsed: isImage ? VISION_MODEL : TEXT_EXTRACTION_MODEL,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[SyllabusParser] Error in ${duration}ms | Request: ${requestId}`, error);

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