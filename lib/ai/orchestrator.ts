// lib/ai/orchestrator.ts – Fully upgraded, token‑efficient, production‑ready with rate‑limit resilience
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import crypto from 'crypto';
import { rateLimiters, checkRateLimit, recordTokenUsage } from '@/lib/rate-limit';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });

// ============================================================================
// MODEL MAPPING – heavy for narrative, light for everything else
// ============================================================================
const MODELS = {
  heavy: {
    groq: 'llama-3.3-70b-versatile',
    google: 'gemini-2.5-pro',
  },
  light: {
    groq: 'llama-3.1-8b-instant',
    google: 'gemini-2.5-flash',
  },
} as const;

// ============================================================================
// 1. CUSTOM ERROR FOR RATE LIMITS (so Inngest can retry with delay)
// ============================================================================
export class RateLimitError extends Error {
  retryAfter: number; // seconds
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// 2. SMART FALLBACK WITH TOKEN BUDGETING & RETRY-AFTER HANDLING
// ============================================================================
async function callWithFallback<T>(
  fn: (provider: 'groq' | 'google', model: string) => Promise<T>,
  taskType: 'heavy' | 'light' = 'light',
  userId?: string,
  retriesPerProvider = 3,               // increased for resilience
  baseDelayMs = 3000                     // increased base delay
): Promise<T> {
  const providers: Array<'google' | 'groq'> = ['google', 'groq'];
  let lastRateLimitError: { retryAfter: number } | null = null;

  for (const provider of providers) {
    let attempt = 0;
    while (attempt <= retriesPerProvider) {
      try {
        const model = MODELS[taskType][provider];
        // Small jitter to spread requests
        await new Promise(r => setTimeout(r, Math.random() * 300));
        return await fn(provider, model);
      } catch (error: any) {
        attempt++;

        // Fatal schema errors – throw immediately
        const isValidationError =
          error.name === 'TypeValidationError' ||
          error.name === 'ZodError' ||
          error?.statusCode === 400;
        if (isValidationError) {
          console.error(`[Orchestrator] Fatal schema error on ${provider}.`, error);
          throw error;
        }

        // Determine if the error is retryable
        const isRetryable =
          error?.statusCode === 429 ||
          (error?.statusCode && error.statusCode >= 500) ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET';

        // Capture rate‑limit info
        if (error?.statusCode === 429) {
          const retryAfter = error?.responseHeaders?.['retry-after'];
          if (retryAfter) {
            const seconds = parseInt(retryAfter);
            if (!lastRateLimitError || seconds > lastRateLimitError.retryAfter) {
              lastRateLimitError = { retryAfter: seconds };
            }
          }
        }

        if (!isRetryable) {
          console.warn(`[Orchestrator] Non-retryable error on ${provider}, switching.`, error);
          break; // try next provider
        }

        if (attempt > retriesPerProvider) {
          console.warn(`[Orchestrator] ${provider} exhausted retries, switching.`);
          break;
        }

        // Use retry-after header if present, otherwise exponential backoff + jitter
        const retryAfter = error?.responseHeaders?.['retry-after'];
        const waitMs = retryAfter
          ? Math.min(parseInt(retryAfter) * 1000 + Math.random() * 2000, 60000)
          : Math.min(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000, 60000);

        console.warn(`[Orchestrator] ${provider} retry ${attempt}/${retriesPerProvider} in ${Math.round(waitMs / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }

  // If we exit because of rate limits, throw a special error
  if (lastRateLimitError) {
    throw new RateLimitError(
      'Rate limit exceeded on all providers',
      lastRateLimitError.retryAfter
    );
  }

  throw new Error('All providers failed after exhausting retries and fallbacks.');
}

// ============================================================================
// 3. TIMEOUT WRAPPER
// ============================================================================
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

// ============================================================================
// 4. NARRATIVE ELEMENTS (unchanged from original)
// ============================================================================
const NARRATIVE_TROPES = [
  'A cyberpunk detective solving a corporate conspiracy',
  'A crew of astronauts exploring a derelict, ancient alien space station',
  'A deep-sea expedition discovering a bioluminescent underwater kingdom',
  'A magical academy where spells are powered by strict logic and math',
  'A post-apocalyptic scavenger rebuilding society using lost tech',
  'A Victorian-era steampunk inventor creating clockwork automatons',
  'A lone cartographer mapping a dimension that shifts with knowledge',
  'A ghost librarian helping students uncover forbidden truths',
  'A time-traveling chef gathering recipes from history',
  'A wildlife biologist communicating with alien creatures',
] as const;

const PLOT_TWISTS = [
  'the main character discovers they are actually a simulation',
  'a rival suddenly appears and forces a high-stakes challenge',
  'a natural disaster alters the environment and forces a change of plans',
  'a critical piece of trusted technology spectacularly fails',
  'an ancient prophecy is misinterpreted',
  'a mysterious ally offers help but has hidden motives',
  'a betrayal from a trusted companion',
  'a discovery that the villain was right all along',
  'a sudden time loop resets the scene',
] as const;

const STORY_TONES = [
  'Gritty and suspenseful',
  'Lighthearted and witty',
  'Mysterious and eerie',
  'Epic and cinematic',
  'Warm and encouraging',
  'Intellectually rigorous',
] as const;

// ============================================================================
// 5. SCHEMAS – with case‑insensitive type handling (FIXED)
// ============================================================================
const TopicSchema = z.object({
  topicNumber: z.number(),
  topicTitle: z.string().max(100),
  pedagogicalGoal: z.string().max(200),
  narrativeBeat: z.string().max(150),
  estimatedMinutes: z.number().min(5).max(20),
});

const ChapterBlueprintSchema = z.object({
  topics: z.array(TopicSchema).min(3).max(6),
  totalEstimatedMinutes: z.number(),
});

const BaseQuizSchema = z.object({
  id: z.string(),
  prompt: z.string().max(300),
  explanation: z.string().max(400),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  points: z.number().min(1).max(20),
  hint: z.string().max(150).optional(),
});

const SingleMCQSchema = BaseQuizSchema.extend({
  type: z.literal('single'),
  options: z.array(z.string().max(100)).min(2).max(4),
  correctAnswer: z.string(),
});

const MultipleMCQSchema = BaseQuizSchema.extend({
  type: z.literal('multiple'),
  options: z.array(z.string().max(100)).min(3).max(5),
  correctAnswer: z.array(z.string()).min(2).max(3),
});

const TrueFalseSchema = BaseQuizSchema.extend({
  type: z.literal('truefalse'),
  options: z.array(z.enum(['True', 'False'])).length(2),
  correctAnswer: z.enum(['True', 'False']),
});

const ShortAnswerSchema = BaseQuizSchema.extend({
  type: z.literal('short'),
  correctAnswer: z.string().max(200),
  keywords: z.array(z.string().max(30)).optional(),
});

const QuizUnionSchema = z.union([
  SingleMCQSchema,
  MultipleMCQSchema,
  TrueFalseSchema,
  ShortAnswerSchema,
]);

const CodeDataSchema = z.object({
  language: z.string().max(20),
  code: z.string().max(2000),
  output: z.string().max(500).optional(),
});

const DefinitionDataSchema = z.object({
  term: z.string().max(50),
  definition: z.string().max(300),
  example: z.string().max(200).optional(),
});

const MetadataSchema = z.object({
  readTime: z.number().optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string().max(20)).max(5).optional(),
}).optional();

// FIXED: Use z.preprocess to lowercase the type before discriminated union
const ContentBlockSchema = z.preprocess(
  (val: any) => {
    if (typeof val === 'object' && val !== null && typeof val.type === 'string') {
      return { ...val, type: val.type.toLowerCase() };
    }
    return val;
  },
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('story'),
      id: z.string().optional(),
      title: z.string().max(100).optional(),
      content: z.string().describe('Markdown. Stories: 3+ paragraphs.').max(3000),
      estimatedReadTime: z.number().optional(),
      metadata: MetadataSchema,
    }),
    z.object({
      type: z.literal('fact'),
      id: z.string().optional(),
      title: z.string().max(100).optional(),
      content: z.string().max(1500),
      estimatedReadTime: z.number().optional(),
      metadata: MetadataSchema,
    }),
    z.object({
      type: z.literal('image'),
      id: z.string().optional(),
      title: z.string().max(100).optional(),
      content: z.string().max(300).optional(),
      imagePrompt: z.string().max(400).optional(),
      imageData: z.object({
        url: z.string(),
        caption: z.string().max(200).optional(),
        source: z.string().max(100).optional(),
      }).optional(),
      estimatedReadTime: z.number().optional(),
      metadata: MetadataSchema,
    }),
    z.object({
      type: z.literal('quiz'),
      id: z.string().optional(),
      title: z.string().max(100).optional(),
      quizData: QuizUnionSchema,
      estimatedReadTime: z.number().optional(),
      metadata: MetadataSchema,
    }),
    z.object({
      type: z.literal('definition'),
      id: z.string().optional(),
      title: z.string().max(100).optional(),
      definitionData: DefinitionDataSchema,
      estimatedReadTime: z.number().optional(),
      metadata: MetadataSchema,
    }),
    z.object({
      type: z.literal('code'),
      id: z.string().optional(),
      title: z.string().max(100).optional(),
      codeData: CodeDataSchema,
      estimatedReadTime: z.number().optional(),
      metadata: MetadataSchema,
    }),
    z.object({
      type: z.literal('summary'),
      id: z.string().optional(),
      title: z.string().max(100).optional(),
      content: z.string().max(800),
      estimatedReadTime: z.number().optional(),
      metadata: MetadataSchema,
    }),
  ])
);

const TopicExpansionSchema = z.object({
  blocks: z.array(ContentBlockSchema).min(4).max(8),
});

export type UserProfile = {
  age: number | null;
  classLevel: number;
  hobbies: string[];
  interests: string[];
  learningTempo: 'EASY' | 'NORMAL' | 'EXTREME';
  currentVibe: string;
};

export type GenerateChapterParams = {
  userId: string;
  chapterTitle: string;
  subjectName: string;
  referenceBooks: string[];
  previousChapterTitle?: string;
  nextChapterTitle?: string;
  chapterNumber: number;
  totalChapters: number;
  profile: UserProfile;
};

// ============================================================================
// 6. ENHANCED STORY CONTEXT (richer narrative memory)
// ============================================================================
export type StoryContext = {
  // Basic (kept for backward compatibility with original cache)
  characters: string[];
  locations: string[];
  unresolvedThreads: string[];
  lastEvents: string;
  topicSummaries: string[];

  // Enhanced fields for deeper storytelling
  mainCharacters: Array<{ name: string; role: string; traits: string[]; arc: string[] }>;
  supportingCharacters: string[];
  detailedLocations: Array<{ name: string; description: string }>;
  worldRules: string[];
  overarchingGoal: string;
  currentArc: string;
  emotionalTone: string;
  pacing: 'slow' | 'medium' | 'fast';
  keyConceptsIntroduced: string[];
  conceptsToReinforce: string[];
  recentEvents: string[]; // last 3 events
};

const DEFAULT_STORY_CONTEXT: StoryContext = {
  characters: [],
  locations: [],
  unresolvedThreads: [],
  lastEvents: '',
  topicSummaries: [],
  mainCharacters: [],
  supportingCharacters: [],
  detailedLocations: [],
  worldRules: [],
  overarchingGoal: '',
  currentArc: '',
  emotionalTone: 'neutral',
  pacing: 'medium',
  keyConceptsIntroduced: [],
  conceptsToReinforce: [],
  recentEvents: [],
};

type ChapterCache = {
  blueprint?: z.infer<typeof ChapterBlueprintSchema>;
  context?: StoryContext;
  lastCompletedTopicIndex?: number;   // index of the last successfully completed topic
  expiresAt: number;
};

const chapterCache = new Map<string, ChapterCache>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ============================================================================
// 7. KEY TOPIC EXTRACTOR – with fallback (unchanged from original)
// ============================================================================
function getDefaultConceptsForSubject(subjectName: string, classLevel: number): {
  concepts: string[];
  foundational: string[];
  advanced: string[];
} {
  const lower = subjectName.toLowerCase();
  if (lower.includes('math')) {
    return {
      concepts: ['Number Systems', 'Basic Operations', 'Fractions', 'Algebra', 'Geometry', 'Trigonometry', 'Calculus', 'Statistics'],
      foundational: ['Number Systems', 'Basic Operations', 'Fractions', 'Algebra', 'Geometry'],
      advanced: ['Trigonometry', 'Calculus', 'Statistics', 'Linear Algebra', 'Differential Equations'],
    };
  }
  if (lower.includes('physics')) {
    return {
      concepts: ['Motion', 'Forces', 'Energy', 'Waves', 'Electricity', 'Magnetism', 'Thermodynamics', 'Quantum Physics'],
      foundational: ['Motion', 'Forces', 'Energy', 'Waves', 'Electricity'],
      advanced: ['Magnetism', 'Thermodynamics', 'Quantum Physics', 'Relativity', 'Nuclear Physics'],
    };
  }
  if (lower.includes('history')) {
    return {
      concepts: ['Ancient Civilizations', 'Middle Ages', 'Renaissance', 'Modern Era', 'Contemporary History', 'World Wars', 'Colonialism'],
      foundational: ['Ancient Civilizations', 'Middle Ages', 'Renaissance', 'Modern Era'],
      advanced: ['Contemporary History', 'World Wars', 'Colonialism', 'Post-Colonialism', 'Globalization'],
    };
  }
  if (lower.includes('economics')) {
    return {
      concepts: ['Supply & Demand', 'Markets', 'GDP', 'Inflation', 'Trade', 'Fiscal Policy', 'Monetary Policy', 'Development Economics'],
      foundational: ['Supply & Demand', 'Markets', 'GDP', 'Inflation', 'Trade'],
      advanced: ['Fiscal Policy', 'Monetary Policy', 'Development Economics', 'Game Theory', 'Econometrics'],
    };
  }
  return {
    concepts: [`${subjectName} fundamentals`, `${subjectName} core principles`, `${subjectName} intermediate topics`, `${subjectName} advanced topics`],
    foundational: [`${subjectName} fundamentals`, `${subjectName} core principles`],
    advanced: [`${subjectName} intermediate topics`, `${subjectName} advanced topics`],
  };
}

export async function extractBookConcepts(
  userId: string,
  bookTitles: string[],
  subjectName: string,
  classLevel: number
): Promise<{ concepts: string[]; foundationalTopics: string[]; advancedTopics: string[] }> {
  console.log(`[Orchestrator] Extracting concepts from ${bookTitles.length} books for ${subjectName}...`);

  if (!bookTitles.length) {
    const defaults = getDefaultConceptsForSubject(subjectName, classLevel);
    return {
      concepts: defaults.concepts,
      foundationalTopics: defaults.foundational,
      advancedTopics: defaults.advanced,
    };
  }

  try {
    const result = await callWithFallback(async (provider, model) => {
      const { object, usage } = await withTimeout(
        generateObject({
          model: provider === 'groq' ? groq(model) : google(model),
          providerOptions: provider === 'groq' ? {
            groq: { structuredOutputs: false, response_format: { type: 'json_object' } },
          } : undefined,
          system: 'You are an expert curriculum designer. Extract key concepts from book titles.',
          prompt: `Extract key concepts from these reference books for ${subjectName} (Class ${classLevel}):
Books: ${bookTitles.join(', ')}
Return a JSON object with:
- "concepts": Array of 20-30 key concepts
- "foundationalTopics": Array of 10-15 beginner-friendly topics
- "advancedTopics": Array of 10-15 advanced topics`,
          schema: z.object({
            concepts: z.array(z.string()),
            foundationalTopics: z.array(z.string()),
            advancedTopics: z.array(z.string()),
          }),
          temperature: 0.3,
        }),
        45000
      );
      if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
      return object;
    }, 'light', userId);

    return result;
  } catch (error) {
    console.error(`[Orchestrator] Concept extraction failed, using fallback.`, error);
    const defaults = getDefaultConceptsForSubject(subjectName, classLevel);
    return {
      concepts: defaults.concepts,
      foundationalTopics: defaults.foundational,
      advancedTopics: defaults.advanced,
    };
  }
}

// ============================================================================
// 8. CURRICULUM PLANNER – with improved prompt and fallback (TypeScript error fixed)
// ============================================================================
export async function generateCurriculumPlan(
  userId: string,
  subjectName: string,
  classLevel: number,
  referenceBooks: string[],
  totalChapters: number = 30
): Promise<{
  chapters: Array<{
    chapterNumber: number;
    chapterTitle: string;
    keyTopics: string[];
    estimatedMinutes: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }>;
  totalEstimatedMinutes: number;
  learningObjectives: string[];
}> {
  console.log(`[Orchestrator] Planning ${totalChapters}-chapter curriculum for ${subjectName}...`);

  const bookConcepts = await extractBookConcepts(userId, referenceBooks, subjectName, classLevel);

  try {
    const plan = await callWithFallback(async (provider, model) => {
      const { object, usage } = await withTimeout(
        generateObject({
          model: provider === 'groq' ? groq(model) : google(model),
          providerOptions: provider === 'groq' ? {
            groq: { structuredOutputs: false, response_format: { type: 'json_object' } },
          } : undefined,
          system: 'You are the EduBridge Master Architect. Create a comprehensive curriculum plan.',
          prompt: `Create a ${totalChapters}-chapter curriculum plan for ${subjectName} (Class ${classLevel}).

The response MUST be a JSON object with the following exact structure:
{
  "chapters": [
    {
      "chapterNumber": number,
      "chapterTitle": string,
      "keyTopics": [ "topic1", "topic2", ... ],  // 3-10 topics per chapter
      "estimatedMinutes": number,                // estimated study time per chapter
      "difficulty": "beginner" | "intermediate" | "advanced"
    }
  ],
  "totalEstimatedMinutes": number,               // sum of all chapter minutes
  "learningObjectives": [ "objective1", "objective2", ... ] // overall objectives
}

Reference Books: ${referenceBooks.join(', ')}

Extracted Concepts:
- All Concepts: ${bookConcepts.concepts.slice(0, 20).join(', ')}...
- Foundational Topics: ${bookConcepts.foundationalTopics.join(', ')}
- Advanced Topics: ${bookConcepts.advancedTopics.join(', ')}

Return ONLY the JSON object. Do not include any explanation or markdown.`,
          schema: z.object({
            chapters: z.array(z.object({
              chapterNumber: z.number(),
              chapterTitle: z.string(),
              keyTopics: z.array(z.string()).min(3).max(10),
              estimatedMinutes: z.number(),
              difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
            })).min(5).max(50),
            totalEstimatedMinutes: z.number(),
            learningObjectives: z.array(z.string()),
          }),
          temperature: 0.2,
        }),
        60000
      );
      if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
      return object;
    }, 'light', userId);

    console.log(`[Orchestrator] ✅ Generated ${plan.chapters.length} chapter plan for ${subjectName}`);
    return plan;
  } catch (error) {
    console.error(`[Orchestrator] ⚠️ All providers failed to generate a valid plan. Falling back to default plan.`, error);

    // Fallback: generate a simple plan from default concepts
    const defaults = getDefaultConceptsForSubject(subjectName, classLevel);
    const chapterCount = Math.min(totalChapters, defaults.concepts.length);
    const chapters = Array.from({ length: chapterCount }, (_, i) => {
      const difficulty: 'beginner' | 'intermediate' | 'advanced' =
        i < chapterCount * 0.33 ? 'beginner' :
        i < chapterCount * 0.66 ? 'intermediate' : 'advanced';
      return {
        chapterNumber: i + 1,
        chapterTitle: `Chapter ${i + 1}: ${defaults.concepts[i] || `${subjectName} Topic ${i + 1}`}`,
        keyTopics: [defaults.concepts[i] || `Introduction to ${subjectName}`],
        estimatedMinutes: 45,
        difficulty,
      };
    });
    const totalEstimatedMinutes = chapters.reduce((sum, ch) => sum + ch.estimatedMinutes, 0);
    const learningObjectives = [
      `Master the core concepts of ${subjectName}.`,
      `Apply ${subjectName} principles to solve problems.`,
      `Understand the real-world applications of ${subjectName}.`,
    ];

    console.log(`[Orchestrator] ✅ Generated fallback plan with ${chapters.length} chapters for ${subjectName}`);
    return {
      chapters,
      totalEstimatedMinutes,
      learningObjectives,
    };
  }
}

// ============================================================================
// 9. STORY CONTEXT UPDATER – enhanced version (FIXED)
// ============================================================================
async function updateStoryContext(
  userId: string,
  previousContext: StoryContext,
  newBlocks: any[],
  topicTitle: string
): Promise<StoryContext> {
  const storyBlocks = newBlocks
    .filter(b => b.type === 'story')
    .map(b => b.content)
    .join('\n\n');

  if (!storyBlocks) return previousContext;

  const prompt = `
You are a story summarizer. Given the previous story state and new story content, extract updates.

Previous state:
- Main characters: ${previousContext.mainCharacters.map(c => c.name).join(', ') || 'none'}
- Supporting characters: ${previousContext.supportingCharacters.join(', ') || 'none'}
- Locations: ${previousContext.detailedLocations.map(l => l.name).join(', ') || 'none'}
- Unresolved threads: ${previousContext.unresolvedThreads.join(', ') || 'none'}
- Last events: ${previousContext.lastEvents || 'story begins'}
- Emotional tone: ${previousContext.emotionalTone}

New story content for topic "${topicTitle}":
${storyBlocks.slice(0, 2000)}  // limit context length

Return a JSON object with:
- "newMainCharacters": array of {name, role, traits} (new main characters introduced)
- "newSupportingCharacters": array of names
- "newLocations": array of {name, description}
- "updatedThreads": array of unresolved plot threads (keep previous ones, add new, remove resolved)
- "latestEvents": a one‑sentence summary of what just happened
- "emotionalTone": string (overall tone after this content)
- "conceptLearned": string (one key educational concept from this topic)
- "topicSummary": a one‑line summary of this topic's narrative contribution
`;

  const result = await callWithFallback(async (provider, model) => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: provider === 'groq' ? groq(model) : google(model),
        providerOptions: provider === 'groq' ? {
          groq: { structuredOutputs: false, response_format: { type: 'json_object' } },
        } : undefined,
        schema: z.object({
          newMainCharacters: z.array(z.object({
            name: z.string(),
            role: z.string(),
            traits: z.array(z.string()),
          })).max(2),
          newSupportingCharacters: z.array(z.string()).max(3),
          newLocations: z.array(z.object({
            name: z.string(),
            description: z.string().max(200),
          })).max(2),
          updatedThreads: z.array(z.string()).max(5),
          latestEvents: z.string().max(200),
          emotionalTone: z.string(),
          conceptLearned: z.string().max(100),
          topicSummary: z.string().max(150),
        }),
        prompt,
        temperature: 0.3,
      }),
      45000
    );
    if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
    return object;
  }, 'light', userId);

  // Add empty arc array to new main characters
  const newMainChars = result.newMainCharacters.map(c => ({ ...c, arc: [] }));
  const updatedMainChars = [...previousContext.mainCharacters, ...newMainChars].slice(0, 8);

  const updatedRecentEvents = [...previousContext.recentEvents, result.latestEvents].slice(-3);

  // Merge updates into previous context
  const updated = {
    // Basic fields
    characters: [...new Set([...previousContext.characters, ...newMainChars.map(c => c.name), ...result.newSupportingCharacters])],
    locations: [...new Set([...previousContext.locations, ...result.newLocations.map(l => l.name)])],
    unresolvedThreads: result.updatedThreads,
    lastEvents: result.latestEvents,
    topicSummaries: [...previousContext.topicSummaries, result.topicSummary].slice(-3),

    // Enhanced fields
    mainCharacters: updatedMainChars,
    supportingCharacters: [...previousContext.supportingCharacters, ...result.newSupportingCharacters].slice(0, 10),
    detailedLocations: [...previousContext.detailedLocations, ...result.newLocations].slice(0, 6),
    worldRules: previousContext.worldRules,
    overarchingGoal: previousContext.overarchingGoal,
    currentArc: previousContext.currentArc,
    emotionalTone: result.emotionalTone,
    pacing: previousContext.pacing,
    keyConceptsIntroduced: [...previousContext.keyConceptsIntroduced, result.conceptLearned].slice(0, 10),
    conceptsToReinforce: previousContext.conceptsToReinforce,
    recentEvents: updatedRecentEvents,
  };

  // Trim string fields to avoid overflow
  return {
    ...updated,
    characters: updated.characters.map(c => c.substring(0, 100)),
    locations: updated.locations.map(l => l.substring(0, 100)),
    unresolvedThreads: updated.unresolvedThreads.map(t => t.substring(0, 200)),
    lastEvents: updated.lastEvents.substring(0, 500),
    topicSummaries: updated.topicSummaries.map(s => s.substring(0, 200)),
    mainCharacters: updated.mainCharacters.map(c => ({
      ...c,
      name: c.name.substring(0, 50),
      role: c.role.substring(0, 50),
      traits: c.traits.map(t => t.substring(0, 30)),
      arc: c.arc.map(a => a.substring(0, 100)),
    })),
    supportingCharacters: updated.supportingCharacters.map(s => s.substring(0, 50)),
    detailedLocations: updated.detailedLocations.map(l => ({
      name: l.name.substring(0, 50),
      description: l.description.substring(0, 200),
    })),
    worldRules: updated.worldRules.map(r => r.substring(0, 100)),
    overarchingGoal: updated.overarchingGoal.substring(0, 200),
    currentArc: updated.currentArc.substring(0, 200),
    emotionalTone: updated.emotionalTone.substring(0, 50),
    keyConceptsIntroduced: updated.keyConceptsIntroduced.map(k => k.substring(0, 100)),
    conceptsToReinforce: updated.conceptsToReinforce.map(k => k.substring(0, 100)),
    recentEvents: updated.recentEvents.map(e => e.substring(0, 500)),
  };
}

// ============================================================================
// 10. TWO-STAGE TOPIC EXPANSION (token-efficient)
// ============================================================================
async function generateBlockPlan(
  userId: string,
  topic: any,
  context: any
): Promise<Array<{ type: string; estimatedTokens: number }>> {
  return await callWithFallback(async (provider, model) => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: provider === 'groq' ? groq(model) : google(model),
        providerOptions: provider === 'groq' ? {
          groq: { structuredOutputs: false, response_format: { type: 'json_object' } },
        } : undefined,
        system: 'Plan content blocks for a topic. Return JSON array.',
        prompt: `Topic: ${topic.topicTitle}. Difficulty: ${context.difficultyLevel}. Plan 5-7 blocks mixing: story, fact, quiz, definition, image, code, summary. Return: [{type, estimatedTokens}]`,
        schema: z.array(z.object({
          type: z.enum(['story', 'fact', 'quiz', 'definition', 'image', 'code', 'summary']),
          estimatedTokens: z.number().min(100).max(2000),
        })).min(4).max(7),
        temperature: 0.2,
      }),
      25000
    );
    if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
    return object;
  }, 'light', userId);
}

async function generateIndividualBlock(
  userId: string,
  blockType: string,
  topic: any,
  context: any,
  storyCtx: StoryContext
): Promise<any> {
  const taskType = blockType === 'story' ? 'heavy' : 'light';

  const prompts: Record<string, { system: string; prompt: string }> = {
    story: {
      system: `Write engaging educational story. Tone: ${context.randomTone}. Universe: ${context.randomTrope}.`,
      prompt: `Topic: ${topic.topicTitle}. Weave in: hobbies[${context.safeHobbies}], interests[${context.safeInterests}]. Story context: chars[${storyCtx.mainCharacters.map(c => c.name).join(',')}], events[${storyCtx.recentEvents.join(';')}]. Write 3-4 paragraphs teaching ${topic.pedagogicalGoal}. Return JSON: {type:"story", content:string, title?:string}`,
    },
    fact: {
      system: 'Explain a key concept clearly with examples.',
      prompt: `Explain: ${topic.pedagogicalGoal}. Level: ${context.difficultyLevel}. Include 1-2 real-world examples. Return JSON: {type:"fact", content:string, title?:string}`,
    },
    quiz: {
      system: 'Create a fair quiz question with clear correct answer.',
      prompt: `Quiz on: ${topic.pedagogicalGoal}. Difficulty: ${context.difficultyLevel}. Return JSON with quizData: {type:"quiz", quizData:{type, options, correctAnswer, explanation, points}}`,
    },
    definition: {
      system: 'Define a term concisely with example.',
      prompt: `Define key term from: ${topic.pedagogicalGoal}. Include brief example. Return JSON: {type:"definition", definitionData:{term, definition, example?}}`,
    },
    image: {
      system: 'Create detailed image prompt for educational concept.',
      prompt: `Visualize: ${topic.pedagogicalGoal}. Style: educational illustration, no text. Return JSON: {type:"image", imagePrompt:string}`,
    },
    code: {
      system: 'Provide working code example with explanation.',
      prompt: `Code example for: ${topic.pedagogicalGoal}. Language: Python. Include comments. Return JSON: {type:"code", codeData:{language, code, output?}}`,
    },
    summary: {
      system: 'Summarize key takeaways concisely.',
      prompt: `Summarize: ${topic.pedagogicalGoal}. 3-5 bullet points. Return JSON: {type:"summary", content:string}`,
    },
  };

  const config = prompts[blockType] || prompts.fact;

  return await callWithFallback(async (provider, model) => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: provider === 'groq' ? groq(model) : google(model),
        providerOptions: provider === 'groq' ? {
          groq: { structuredOutputs: false, response_format: { type: 'json_object' } },
        } : undefined,
        system: config.system,
        prompt: config.prompt,
        schema: ContentBlockSchema,
        temperature: blockType === 'story' ? 0.7 : 0.3,
      }),
      blockType === 'story' ? 45000 : 30000
    );
    if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
    return object;
  }, taskType, userId);
}

async function expandTopic(
  topic: any,
  context: {
    chapterNumber: number;
    totalChapters: number;
    chapterTitle: string;
    totalTopics: number;
    difficultyLevel: string;
    randomTrope: string;
    randomTone: string;
    randomTwist: string;
    referenceContext: string;
    focusModeDirectives: string;
    safeHobbies: string;
    safeInterests: string;
    storyContext: StoryContext;
    previousChapterSummary?: string;
    nextChapterTeaser?: string;
  },
  userId: string
): Promise<any[]> {
  const blockPlan = await generateBlockPlan(userId, topic, context);

  const blocks: any[] = [];
  for (const plan of blockPlan) {
    try {
      const block = await generateIndividualBlock(
        userId,
        plan.type,
        topic,
        context,
        context.storyContext
      );
      if (block) blocks.push({ id: crypto.randomUUID(), ...block });
    } catch (error) {
      console.warn(`[Orchestrator] Block ${plan.type} failed, skipping.`, error);
    }
    // Increased delay to avoid hitting request-per-minute limits
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500));
  }

  return blocks;
}

// ============================================================================
// 11. THE MASTER TUTOR ENGINE – with rate‑limit resilience and progress caching
// ============================================================================
export async function generateChapterContent(params: GenerateChapterParams) {
  const startTime = Date.now();
  const {
    userId,
    chapterTitle,
    subjectName,
    profile,
    referenceBooks,
    previousChapterTitle,
    nextChapterTitle,
    chapterNumber,
    totalChapters,
  } = params;

  if (totalChapters < 1 || chapterNumber < 1 || chapterNumber > totalChapters) {
    throw new Error(`Invalid chapter parameters: ${chapterNumber}/${totalChapters}`);
  }

  console.log(`[Orchestrator] Generating Chapter ${chapterNumber}/${totalChapters}: ${chapterTitle}`);

  const rateLimit = await checkRateLimit(rateLimiters.chapterGeneration, userId);
  if (!rateLimit.success) {
    console.warn(`[Orchestrator] 🛑 Rate limit exceeded for user ${userId}. Yielding to Inngest retries.`);
    throw new Error('RATE_LIMIT_EXCEEDED');
  }

  let difficultyLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
  if (chapterNumber > totalChapters * 0.66) difficultyLevel = 'advanced';
  else if (chapterNumber > totalChapters * 0.33) difficultyLevel = 'intermediate';

  let focusModeDirectives = '';
  if (profile.learningTempo === 'EASY') {
    focusModeDirectives = `FOCUS MODE: EASY. Prioritize extreme simplicity. Use LONG, highly engaging, character-driven story segments (4-5 paragraphs each). Explain facts gently with multiple analogies. This is ${difficultyLevel} level content.`;
  } else if (profile.learningTempo === 'NORMAL') {
    focusModeDirectives = `FOCUS MODE: NORMAL. Balance deep, engaging narrative with rigorous logical facts. Include 2-3 stories per topic. Adjust complexity for ${difficultyLevel} level.`;
  } else if (profile.learningTempo === 'EXTREME') {
    focusModeDirectives = `FOCUS MODE: EXTREME. Maximum academic rigor. INCLUDE the deep history of the concept, advanced edge-cases, and research paper references. This is ${difficultyLevel} level - push the boundaries.`;
  }

  const safeHobbies = profile.hobbies?.length
    ? profile.hobbies.join(', ').substring(0, 200)
    : 'technology and adventure';
  const safeInterests = profile.interests?.length
    ? profile.interests.join(', ').substring(0, 200)
    : 'general knowledge';

  const tropeIndex = chapterNumber % NARRATIVE_TROPES.length;
  const twistIndex = (chapterNumber + 3) % PLOT_TWISTS.length;
  const toneIndex = (chapterNumber + 1) % STORY_TONES.length;

  const randomTrope = NARRATIVE_TROPES[tropeIndex];
  const randomTwist = PLOT_TWISTS[twistIndex];
  const randomTone = STORY_TONES[toneIndex];

  const randomBytes = crypto.randomBytes(4).toString('hex');
  const entropySeed = crypto
    .createHash('sha256')
    .update(`${Date.now()}-${randomBytes}-${chapterTitle}-${chapterNumber}`)
    .digest('hex')
    .substring(0, 8);

  let referenceContext = '';
  if (referenceBooks && referenceBooks.length > 0) {
    referenceContext = `\n📚 CRITICAL REFERENCE BOOKS: This is Chapter ${chapterNumber} of ${totalChapters}. You MUST anchor your facts closely to these reference materials: ${referenceBooks.join(', ')}. 
    - Quote specific concepts, theories, or examples from these books where relevant.
    - If this is an early chapter (1-${Math.floor(totalChapters * 0.33)}), focus on FOUNDATIONAL concepts from the books.
    - If this is a middle chapter (${Math.floor(totalChapters * 0.33) + 1}-${Math.floor(totalChapters * 0.66)}), focus on APPLICATIONS and intermediate topics from the books.
    - If this is an advanced chapter (${Math.floor(totalChapters * 0.66) + 1}-${totalChapters}), focus on CUTTING-EDGE content and complex theories from the books.
    - ALWAYS cite which book a concept comes from when possible.`;
  }

  const cacheKey = `chapter:${userId}:${subjectName}:${chapterNumber}`;
  const cached = chapterCache.get(cacheKey);
  const now = Date.now();

  // PHASE 1: CHAPTER BLUEPRINT (with cache)
  let blueprint;
  if (cached?.blueprint && cached.expiresAt > now) {
    console.log(`[Orchestrator] Using cached blueprint for "${chapterTitle}"`);
    blueprint = cached.blueprint;
  } else {
    console.log(`[Orchestrator] Phase 1: Creating chapter blueprint for "${chapterTitle}"...`);
    blueprint = await callWithFallback(async (provider, model) => {
      const { object, usage } = await withTimeout(
        generateObject({
          model: provider === 'groq' ? groq(model) : google(model),
          providerOptions: provider === 'groq' ? {
            groq: { structuredOutputs: false, response_format: { type: 'json_object' } },
          } : undefined,
          system: `You are the EduBridge Master Architect. Your ONLY task is to create a high-level blueprint for Chapter ${chapterNumber} of ${totalChapters}. Do NOT generate any actual lesson content. Only output the blueprint structure.

DIVIDE this chapter into 4-6 distinct TOPICS.

For each topic, provide:
- "topicNumber" (integer)
- "topicTitle" (string)
- "pedagogicalGoal" (string)
- "narrativeBeat" (string)
- "estimatedMinutes" (5-15)

Return a JSON object with "topics" array and "totalEstimatedMinutes".`,
          prompt: `Create a detailed topic blueprint for: ${chapterTitle} (${subjectName})

Student Profile:
- Grade/Class: ${profile.classLevel || 10}
- Hobbies: ${safeHobbies}
- Interests: ${safeInterests}
- Learning Tempo: ${profile.learningTempo}

Reference Books: ${referenceBooks.join(', ')}

Return ONLY valid JSON.`,
          schema: ChapterBlueprintSchema,
          temperature: 0.2,
        }),
        45000
      );
      if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
      return object;
    }, 'light', userId);

    if (!blueprint.topics || blueprint.topics.length === 0) {
      throw new Error('Blueprint generation returned zero topics');
    }

    chapterCache.set(cacheKey, {
      blueprint,
      context: cached?.context || DEFAULT_STORY_CONTEXT,
      lastCompletedTopicIndex: -1, // none completed yet
      expiresAt: now + CACHE_TTL,
    });
  }

  // PHASE 2: TOPIC EXPANSION with narrative context – resume from last completed topic
  let storyContext: StoryContext = cached?.context || DEFAULT_STORY_CONTEXT;
  const startIndex = (cached?.lastCompletedTopicIndex ?? -1) + 1; // next topic to process

  console.log(`[Orchestrator] Phase 2: Expanding ${blueprint.topics.length} topics for "${chapterTitle}" sequentially (resuming from topic ${startIndex})...`);
  let allBlocks: any[] = [];
  let successfulTopics = startIndex; // already have startIndex topics completed from previous runs

  for (let i = startIndex; i < blueprint.topics.length; i++) {
    const topic = blueprint.topics[i];
    try {
      const blocks = await expandTopic(topic, {
        chapterNumber,
        totalChapters,
        chapterTitle,
        totalTopics: blueprint.topics.length,
        difficultyLevel,
        randomTrope,
        randomTone,
        randomTwist,
        referenceContext,
        focusModeDirectives,
        safeHobbies,
        safeInterests,
        storyContext,
        previousChapterSummary: previousChapterTitle,
        nextChapterTeaser: nextChapterTitle,
      }, userId);

      allBlocks.push(...blocks);
      successfulTopics = i; // after success, this topic is done

      storyContext = await updateStoryContext(userId, storyContext, blocks, topic.topicTitle);

      // Update cache with progress
      chapterCache.set(cacheKey, {
        blueprint,
        context: storyContext,
        lastCompletedTopicIndex: i,
        expiresAt: now + CACHE_TTL,
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        // Save progress and rethrow – Inngest will retry after the required delay
        console.warn(`[Orchestrator] Rate limit hit at topic ${i}. Saving progress and throwing.`);
        chapterCache.set(cacheKey, {
          blueprint,
          context: storyContext,
          lastCompletedTopicIndex: i - 1, // last completed is previous topic
          expiresAt: now + CACHE_TTL,
        });
        throw error; // Inngest will see this and retry according to its policy
      }
      console.error(`[Orchestrator] ⚠️ Topic ${topic.topicNumber} of "${chapterTitle}" failed after retries:`, error);
      // Continue to next topic even if one fails
    }
  }

  // If we finished the loop but got less than half topics successful, it's a fatal error (shouldn't happen with rate‑limit handling)
  if (successfulTopics < Math.ceil(blueprint.topics.length / 2) - 1) { // -1 because successfulTopics is index
    throw new Error(`CRITICAL: Majority of topics failed for "${chapterTitle}". Aborting chapter generation.`);
  }

  // PHASE 3: ASSEMBLY & IMAGE URLS
  console.log(`[Orchestrator] Phase 3: Assembling ${allBlocks.length} blocks for "${chapterTitle}"...`);
  let finalBlocks = allBlocks.map((block) => {
    const finalBlock: any = {
      id: block.id || crypto.randomUUID(),
      ...block,
    };

    if (block.type === 'image' && block.imagePrompt) {
      const safePrompt = block.imagePrompt.substring(0, 400);
      const styleModifier = `cinematic, ultra-detailed educational illustration, no text, ${difficultyLevel} level complexity, professional textbook quality`;
      const encodedPrompt = encodeURIComponent(`${safePrompt}, ${styleModifier}`);

      finalBlock.imageData = {
        url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${entropySeed}`,
        caption: block.imagePrompt,
      };
      delete finalBlock.imagePrompt;
    }

    return finalBlock;
  });

  const seenIds = new Set<string>();
  finalBlocks = finalBlocks.map((block) => {
    let { id } = block;
    while (seenIds.has(id)) {
      id = crypto.randomUUID();
    }
    seenIds.add(id);
    return { ...block, id };
  });

  const generationDuration = Date.now() - startTime;
  console.log(`[Orchestrator] ✅ Success! Generated ${finalBlocks.length} blocks for Chapter ${chapterNumber}: "${chapterTitle}" (took ${generationDuration}ms)`);

  // Clear the cache entry upon successful completion (optional, but keeps cache clean)
  chapterCache.delete(cacheKey);

  return {
    blocks: finalBlocks,
    totalTopics: blueprint.topics.length,
    totalEstimatedMinutes: blueprint.totalEstimatedMinutes,
  };
}

// ============================================================================
// 12. EVALUATION ENGINE – with fallback (unchanged)
// ============================================================================
export async function evaluateAnswer(
  userId: string,
  question: { type: string; correctAnswer: string | string[]; keywords?: string[] },
  userAnswer: string,
  context: string
) {
  return await callWithFallback(async (provider, model) => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: provider === 'groq' ? groq(model) : google(model),
        providerOptions: provider === 'groq' ? {
          groq: { structuredOutputs: false, response_format: { type: 'json_object' } },
        } : undefined,
        system: `You are an expert grader. Provide a score (0-100), a boolean isCorrect, and detailed feedback. Return JSON.`,
        prompt: `Evaluate this student answer.
                 Question Type: ${question.type}
                 Question: ${JSON.stringify(question)}
                 Lesson Context: ${context.slice(0, 20000)}
                 Student Answer: "${userAnswer}"
                 
                 Return a JSON object with fields: score, isCorrect, feedback.`,
        schema: z.object({
          score: z.number().min(0).max(100),
          isCorrect: z.boolean(),
          feedback: z.string(),
        }),
      }),
      45000
    );
    if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
    return object;
  }, 'light', userId);
}