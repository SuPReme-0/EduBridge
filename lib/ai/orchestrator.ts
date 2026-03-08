import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import crypto from 'crypto';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';

// ============================================================================
// 1. HELPER: SMART EXPONENTIAL BACKOFF WITH ERROR FILTERING
// ============================================================================
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      // Do NOT retry if the AI fundamentally misunderstood the Zod schema
      // or if it's a hard 400 Bad Request error (client error).
      const isValidationError =
        error.name === 'TypeValidationError' ||
        error.name === 'ZodError' ||
        error?.statusCode === 400;

      if (isValidationError) {
        console.error(
          '[Orchestrator] Fatal Schema/Request Error. Bypassing retries.',
          error
        );
        throw error;
      }

      // Only retry on network errors, 429 (rate limit), or 5xx server errors
      const isRetryable =
        error?.statusCode === 429 ||
        (error?.statusCode && error.statusCode >= 500) ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET';

      if (!isRetryable || i === retries - 1) {
        throw error;
      }

      console.warn(
        `[Orchestrator Retry] API choked (Attempt ${i + 1}). Retrying in ${delayMs}ms...`
      );
      await new Promise((res) => setTimeout(res, delayMs));
      delayMs *= 2; // Exponential backoff
    }
  }
  throw new Error('Unreachable');
}

// ============================================================================
// 2. HIGH-ENTROPY GENERATORS
// ============================================================================
const NARRATIVE_TROPES = [
  'A cyberpunk detective solving a corporate conspiracy',
  'A crew of astronauts exploring a derelict, ancient alien space station',
  'A deep-sea expedition discovering a bioluminescent underwater kingdom',
  'A magical academy where spells are powered by strict logic and math',
  'A post-apocalyptic scavenger rebuilding society using lost tech',
  'A Victorian-era steampunk inventor creating clockwork automatons',
];

const PLOT_TWISTS = [
  'the main character discovers they are actually a simulation',
  'a rival suddenly appears and forces a high-stakes challenge',
  'a natural disaster alters the environment and forces a change of plans',
  'a critical piece of trusted technology spectacularly fails',
];

const STORY_TONES = [
  'Gritty and suspenseful',
  'Lighthearted and witty',
  'Mysterious and eerie',
  'Epic and cinematic',
];

// ============================================================================
// 3. SCHEMAS
// ============================================================================
const ChapterBlueprintSchema = z.object({
  dynamicVibe: z.enum([
    'minimalist',
    'cyberpunk',
    'space-odyssey',
    'library-sage',
    'zen-garden',
    'crimson-dark',
  ]),
  sections: z
    .array(
      z.object({
        sectionNumber: z.number(),
        pedagogicalGoal: z.string(),
        narrativeBeat: z.string(),
      })
    )
    .min(3)
    .max(5),
});

const InternalBlockSchema = z.object({
  id: z.string().optional(), // AI might generate it early
  type: z.enum(['story', 'fact', 'image', 'quiz', 'definition']),
  title: z.string().optional(),
  content: z
    .string()
    .optional()
    .describe(
      'Markdown text. MUST be long and detailed (3+ paragraphs for stories).'
    ),
  estimatedReadTime: z.number().optional(),

  definitionData: z
    .object({
      term: z.string(),
      definition: z.string(),
      example: z.string().optional(),
    })
    .optional(),

  imagePrompt: z
    .string()
    .optional()
    .describe(
      "If type is 'image', provide a highly descriptive visual prompt here."
    ),

  quizData: z
    .object({
      id: z.string(),
      prompt: z.string(),
      options: z.array(z.string()).length(4),
      correctAnswer: z.string(),
      explanation: z.string(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      points: z.number(),
      hint: z.string().optional(),
    })
    .optional(),
});

const SectionExpansionSchema = z.object({
  blocks: z.array(InternalBlockSchema).min(3).max(6),
});

export type GenerateChapterParams = {
  userId: string;
  topic: string;
  subjectName: string;
  referenceBooks: string[];
  previousChapterTitle?: string;
  nextChapterTitle?: string;
  profile: {
    age: number | null;
    classLevel: number;
    hobbies: string[];
    interests: string[];
    learningTempo: 'EASY' | 'NORMAL' | 'EXTREME';
    currentVibe: string;
  };
};

// ============================================================================
// 4. THE MASTER TUTOR ENGINE
// ============================================================================
export async function generateChapterContent(
  params: GenerateChapterParams
) {
  const {
    userId,
    topic,
    subjectName,
    profile,
    referenceBooks,
    previousChapterTitle,
    nextChapterTitle,
  } = params;

  console.log(`[Orchestrator] Initializing Deep Generation for: ${topic}`);

  // --------------------------------------------------------------------------
  // RATE LIMITING (explicit error for Inngest to catch)
  // --------------------------------------------------------------------------
  const rateLimit = await checkRateLimit(
    rateLimiters.chapterGeneration,
    userId
  );
  if (!rateLimit.success) {
    console.warn(
      `[Orchestrator] 🛑 Rate limit exceeded for user ${userId}. Yielding to Inngest retries.`
    );
    throw new Error('RATE_LIMIT_EXCEEDED');
  }

  // --------------------------------------------------------------------------
  // FOCUS MODE BASED ON LEARNING TEMPO
  // --------------------------------------------------------------------------
  let focusModeDirectives = '';
  if (profile.learningTempo === 'EASY') {
    focusModeDirectives = `FOCUS MODE: EASY. Prioritize extreme simplicity. Use LONG, highly engaging, character-driven story segments. Explain facts gently.`;
  } else if (profile.learningTempo === 'NORMAL') {
    focusModeDirectives = `FOCUS MODE: NORMAL. Balance deep, engaging narrative with rigorous logical facts.`;
  } else if (profile.learningTempo === 'EXTREME') {
    focusModeDirectives = `FOCUS MODE: EXTREME. Maximum academic rigor. INCLUDE the deep history of the concept and advanced edge-cases.`;
  }

  // --------------------------------------------------------------------------
  // ENTROPY SOURCES
  // --------------------------------------------------------------------------
  const safeHobbies = profile.hobbies?.length
    ? profile.hobbies.join(', ')
    : 'technology and adventure';
  const randomTrope =
    NARRATIVE_TROPES[Math.floor(Math.random() * NARRATIVE_TROPES.length)];
  const randomTwist =
    PLOT_TWISTS[Math.floor(Math.random() * PLOT_TWISTS.length)];
  const randomTone =
    STORY_TONES[Math.floor(Math.random() * STORY_TONES.length)];

  // Cryptographically secure entropy seed (prevents race conditions)
  const randomBytes = crypto.randomBytes(4).toString('hex');
  const entropySeed = crypto
    .createHash('sha256')
    .update(`${Date.now()}-${randomBytes}-${topic}`)
    .digest('hex')
    .substring(0, 8);

  // Reference books context (if any)
  const referenceContext =
    referenceBooks && referenceBooks.length > 0
      ? `\nCRITICAL GROUNDING: Anchor your facts closely to these materials: ${referenceBooks.join(
          ', '
        )}.`
      : '';

  const contextBlock = `
    Student Grade: ${profile.classLevel || 10}. Hobbies: ${safeHobbies}.
    Narrative Universe: "${randomTrope}". Tone: "${randomTone}". Twist: "${randomTwist}".
    Flow: ${
      previousChapterTitle ? `Came from [${previousChapterTitle}]` : ''
    } -> Current [${topic}] -> ${
    nextChapterTitle ? `Leads to [${nextChapterTitle}]` : ''
  }
    ${focusModeDirectives}
    ${referenceContext}
  `;

  // ==========================================================================
  // PHASE 1: THE BLUEPRINT
  // ==========================================================================
  console.log(`[Orchestrator] Phase 1: Drafting Blueprint (Gemini Pro)...`);

  const blueprint = await withRetry(async () => {
    const { object } = await generateObject({
      model: google('gemini-2.5-pro'),
      system: `You are the EduBridge Architect. Divide the topic into a perfectly logical progression. Ensure narrative seamlessly wraps facts.
               CONTEXT: ${contextBlock}`,
      prompt: `Create the structural blueprint for: ${topic} (${subjectName}).`,
      schema: ChapterBlueprintSchema,
      temperature: 0.7,
    });
    return object;
  });

  // Fallback for dynamicVibe (just in case)
  const resolvedVibe = blueprint.dynamicVibe || 'minimalist';

  // ==========================================================================
  // PHASE 2: FAULT-TOLERANT PARALLEL EXPANSION
  // ==========================================================================
  console.log(
    `[Orchestrator] Phase 2: Expanding ${blueprint.sections.length} sections in parallel (Gemini Flash)...`
  );

  const expansionPromises = blueprint.sections.map(async (section) => {
    return await withRetry(async () => {
      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
        system: `You are drafting Section ${section.sectionNumber} of ${
          blueprint.sections.length
        }.
                 
                 UNIVERSE: ${randomTrope}
                 TONE: ${randomTone}
                 TWIST: ${randomTwist}
                 REFERENCES: ${
                   referenceBooks.length ? referenceBooks.join(', ') : 'None'
                 }
                 
                 GOAL: ${section.pedagogicalGoal}
                 BEAT: ${section.narrativeBeat}
                 
                 STRICT RULES:
                 1. ${focusModeDirectives}
                 2. Write LONG story blocks (at least 2-3 paragraphs).
                 3. Mix questions (quizzes), facts, and definitions naturally.
                 4. Ensure the logical flow connects perfectly to the pedagogical goal.`,
        prompt: `Write deep, detailed blocks for Section ${section.sectionNumber}.`,
        schema: SectionExpansionSchema,
        temperature: 0.8,
      });
      return object.blocks;
    }, 3, 3000);
  });

  const expansionResults = await Promise.allSettled(expansionPromises);

  let internalBlocks: any[] = [];
  let successfulSections = 0;

  expansionResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      internalBlocks.push(...result.value);
      successfulSections++;
    } else {
      console.error(
        `[Orchestrator] ⚠️ Section ${index + 1} completely failed after retries:`,
        result.reason
      );
    }
  });

  // If more than half the sections failed, abort so Inngest retries the whole job.
  if (successfulSections < Math.ceil(blueprint.sections.length / 2)) {
    throw new Error(
      'CRITICAL: Majority of section expansions failed. Aborting chapter generation.'
    );
  }

  // ==========================================================================
  // PHASE 3: ASSEMBLY & URL RESOLUTION
  // ==========================================================================
  console.log(`[Orchestrator] Phase 3: Assembling and rendering image URLs...`);

  // First pass: build blocks with IDs (preserve AI-generated ones, otherwise create)
  let finalBlocks = internalBlocks.map((block) => {
    const finalBlock: any = {
      id: block.id || crypto.randomUUID(),
      ...block,
    };

    if (block.type === 'image' && block.imagePrompt) {
      // Truncate prompt to avoid URI too long errors
      const safePrompt = block.imagePrompt.substring(0, 400);
      const styleModifier = `cinematic, ultra-detailed educational illustration, no text, ${resolvedVibe} style`;
      const encodedPrompt = encodeURIComponent(
        `${safePrompt}, ${styleModifier}`
      );

      finalBlock.imageData = {
        url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${entropySeed}`,
        caption: block.imagePrompt,
      };
      delete finalBlock.imagePrompt;
    }

    return finalBlock;
  });

  // Ensure all block IDs are unique (fixes potential AI-generated duplicates)
  const seenIds = new Set<string>();
  finalBlocks = finalBlocks.map((block) => {
    let { id } = block;
    while (seenIds.has(id)) {
      id = crypto.randomUUID();
    }
    seenIds.add(id);
    return { ...block, id };
  });

  console.log(
    `[Orchestrator] ✅ Success! Yielded ${finalBlocks.length} blocks for ${topic}.`
  );

  return {
    dynamicVibe: resolvedVibe,
    blocks: finalBlocks,
  };
}

// ============================================================================
// 5. EVALUATION ENGINE
// ============================================================================
export async function evaluateAnswer(
  question: any,
  userAnswer: string,
  context: string
) {
  return await withRetry(async () => {
    const { object: evaluation } = await generateObject({
      model: google('gemini-2.5-flash'),
      prompt: `Evaluate this student answer.
               Question: ${JSON.stringify(question)}
               // Massive context allowance (Flash can handle 1M tokens, 20k chars is safe)
               Lesson Context: ${context.slice(0, 20000)}
               Student Answer: "${userAnswer}"
               
               Provide a score (0-100), feedback, and whether it's correct.`,
      schema: z.object({
        score: z.number().min(0).max(100),
        isCorrect: z.boolean(),
        feedback: z.string(),
      }),
    });
    return evaluation;
  }, 2, 1000);
}