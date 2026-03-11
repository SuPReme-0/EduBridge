import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import crypto from 'crypto';
import { rateLimiters, checkRateLimit, recordTokenUsage } from '@/lib/rate-limit';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });

// Model mapping for different tasks
const MODELS = {
  // Heavy tasks (e.g., topic expansion, blueprint generation)
  heavy: {
    groq: 'llama-3.3-70b-versatile',
    google: 'gemini-2.5-pro',
  },
  // Light tasks (e.g., concept extraction, evaluation)
  light: {
    groq: 'llama-3.1-8b-instant',
    google: 'gemini-2.5-flash',
  },
};

// ============================================================================
// 1. HELPER: CALL WITH FALLBACK (Gemini first, then Groq)
// ============================================================================
async function callWithFallback<T>(
  fn: (provider: 'groq' | 'google', model: string) => Promise<T>,
  taskType: 'heavy' | 'light' = 'light',
  retriesPerProvider = 2,
  baseDelayMs = 2000
): Promise<T> {
  // Prioritize Google (Gemini) first, then Groq
  const providers: Array<'groq' | 'google'> = ['google', 'groq'];
  
  for (const provider of providers) {
    let attempt = 0;
    while (attempt <= retriesPerProvider) {
      try {
        const model = MODELS[taskType][provider];
        return await fn(provider, model);
      } catch (error: any) {
        attempt++;
        const isValidationError =
          error.name === 'TypeValidationError' ||
          error.name === 'ZodError' ||
          error?.statusCode === 400;

        if (isValidationError) {
          console.error(`[Orchestrator] Fatal Schema Error on ${provider}.`, error);
          throw error; // validation errors are not retryable
        }

        const isRetryable =
          error?.statusCode === 429 ||
          (error?.statusCode && error.statusCode >= 500) ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET';

        if (!isRetryable) {
          // Non-retryable error for this provider, break out to try next provider
          console.warn(`[Orchestrator] Non-retryable error on ${provider}, switching provider.`, error);
          break; // exit while loop, move to next provider
        }

        if (attempt > retriesPerProvider) {
          console.warn(`[Orchestrator] ${provider} failed after ${retriesPerProvider} retries, switching provider.`);
          break; // exit while loop, move to next provider
        }

        // Retry with exponential backoff
        const waitMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000, 60000);
        console.warn(`[Orchestrator] ${provider} retry ${attempt}/${retriesPerProvider} in ${Math.round(waitMs / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
  
  throw new Error('All providers failed after exhausting retries.');
}

// ============================================================================
// 2. TIMEOUT WRAPPER
// ============================================================================
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    )
  ]);
}

// ============================================================================
// 3. NARRATIVE ELEMENTS
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
// 4. SCHEMAS (unchanged)
// ============================================================================
const TopicSchema = z.object({
  topicNumber: z.number(),
  topicTitle: z.string(),
  pedagogicalGoal: z.string(),
  narrativeBeat: z.string(),
  estimatedMinutes: z.number(),
});

const ChapterBlueprintSchema = z.object({
  topics: z.array(TopicSchema).min(3).max(8),
  totalEstimatedMinutes: z.number(),
});

const BaseQuizSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  points: z.number(),
  hint: z.string().optional(),
});

const SingleMCQSchema = BaseQuizSchema.extend({
  type: z.literal('single'),
  options: z.array(z.string()).min(2).max(6),
  correctAnswer: z.string(),
});

const MultipleMCQSchema = BaseQuizSchema.extend({
  type: z.literal('multiple'),
  options: z.array(z.string()).min(3).max(8),
  correctAnswer: z.array(z.string()).min(2).max(4),
});

const TrueFalseSchema = BaseQuizSchema.extend({
  type: z.literal('truefalse'),
  options: z.array(z.enum(['True', 'False'])).length(2),
  correctAnswer: z.enum(['True', 'False']),
});

const ShortAnswerSchema = BaseQuizSchema.extend({
  type: z.literal('short'),
  correctAnswer: z.string(),
  keywords: z.array(z.string()).optional(),
});

const QuizUnionSchema = z.union([
  SingleMCQSchema,
  MultipleMCQSchema,
  TrueFalseSchema,
  ShortAnswerSchema,
]);

const CodeDataSchema = z.object({
  language: z.string(),
  code: z.string(),
  output: z.string().optional(),
});

const DefinitionDataSchema = z.object({
  term: z.string(),
  definition: z.string(),
  example: z.string().optional(),
});

const MetadataSchema = z.object({
  readTime: z.number().optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).optional();

const ContentBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('story'),
    id: z.string().optional(),
    title: z.string().optional(),
    content: z.string().describe('Markdown text. MUST be long and detailed (3+ paragraphs for stories).'),
    estimatedReadTime: z.number().optional(),
    metadata: MetadataSchema,
  }),
  z.object({
    type: z.literal('fact'),
    id: z.string().optional(),
    title: z.string().optional(),
    content: z.string(),
    estimatedReadTime: z.number().optional(),
    metadata: MetadataSchema,
  }),
  z.object({
    type: z.literal('image'),
    id: z.string().optional(),
    title: z.string().optional(),
    content: z.string().optional(),
    imagePrompt: z.string().optional(),
    imageData: z.object({
      url: z.string(),
      caption: z.string().optional(),
      source: z.string().optional(),
    }).optional(),
    estimatedReadTime: z.number().optional(),
    metadata: MetadataSchema,
  }),
  z.object({
    type: z.literal('quiz'),
    id: z.string().optional(),
    title: z.string().optional(),
    quizData: QuizUnionSchema,
    estimatedReadTime: z.number().optional(),
    metadata: MetadataSchema,
  }),
  z.object({
    type: z.literal('definition'),
    id: z.string().optional(),
    title: z.string().optional(),
    definitionData: DefinitionDataSchema,
    estimatedReadTime: z.number().optional(),
    metadata: MetadataSchema,
  }),
  z.object({
    type: z.literal('code'),
    id: z.string().optional(),
    title: z.string().optional(),
    codeData: CodeDataSchema,
    estimatedReadTime: z.number().optional(),
    metadata: MetadataSchema,
  }),
  z.object({
    type: z.literal('summary'),
    id: z.string().optional(),
    title: z.string().optional(),
    content: z.string(),
    estimatedReadTime: z.number().optional(),
    metadata: MetadataSchema,
  }),
]);

// Allow 3-12 blocks to accommodate AI variability
const TopicExpansionSchema = z.object({
  blocks: z.array(ContentBlockSchema).min(3).max(12),
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
// 5. CACHE TYPES AND IN-MEMORY STORE
// ============================================================================
type StoryContext = {
  characters: string[];
  locations: string[];
  unresolvedThreads: string[];
  lastEvents: string;
  topicSummaries: string[]; // Keep last 3 summaries to avoid overflow
};

type ChapterCache = {
  blueprint?: z.infer<typeof ChapterBlueprintSchema>;
  context?: StoryContext;
  expiresAt: number;
};

const chapterCache = new Map<string, ChapterCache>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ============================================================================
// 6. KEY TOPIC EXTRACTOR – with fallback
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
            groq: {
              structuredOutputs: false,
              response_format: { type: 'json_object' },
            },
          } : undefined,
          system: `You are an expert curriculum designer. Extract key concepts from book titles.`,
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
    }, 'light'); // light task

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
// 7. CURRICULUM PLANNER – with improved prompt and fallback
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
            groq: {
              structuredOutputs: false,
              response_format: { type: 'json_object' },
            },
          } : undefined,
          system: `You are the EduBridge Master Architect. Create a comprehensive curriculum plan.`,
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
          temperature: 0.2, // lower temperature for deterministic output
        }),
        60000
      );
      if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
      return object;
    }, 'light'); // light task

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
// 8. STORY CONTEXT UPDATER – with fallback
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
- Characters: ${previousContext.characters.join(', ') || 'none'}
- Locations: ${previousContext.locations.join(', ') || 'none'}
- Unresolved threads: ${previousContext.unresolvedThreads.join(', ') || 'none'}
- Last events: ${previousContext.lastEvents || 'story begins'}

New story content for topic "${topicTitle}":
${storyBlocks}

Return a JSON object with:
- "newCharacters": array of character names introduced (if any)
- "newLocations": array of location names introduced
- "updatedThreads": array of unresolved plot threads (keep previous ones, add new, remove resolved)
- "latestEvents": a one‑sentence summary of what just happened
- "topicSummary": a one‑line summary of this topic's educational + narrative contribution
`;

  const result = await callWithFallback(async (provider, model) => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: provider === 'groq' ? groq(model) : google(model),
        providerOptions: provider === 'groq' ? {
          groq: {
            structuredOutputs: false,
            response_format: { type: 'json_object' },
          },
        } : undefined,
        schema: z.object({
          newCharacters: z.array(z.string()),
          newLocations: z.array(z.string()),
          updatedThreads: z.array(z.string()),
          latestEvents: z.string(),
          topicSummary: z.string(),
        }),
        prompt,
        temperature: 0.3,
      }),
      45000
    );
    if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
    return object;
  }, 'light'); // light task

  const updated = {
    characters: [...new Set([...previousContext.characters, ...result.newCharacters])],
    locations: [...new Set([...previousContext.locations, ...result.newLocations])],
    unresolvedThreads: result.updatedThreads,
    lastEvents: result.latestEvents,
    topicSummaries: [...previousContext.topicSummaries, result.topicSummary].slice(-3),
  };

  return {
    characters: updated.characters.map((c: string) => c.substring(0, 100)),
    locations: updated.locations.map((l: string) => l.substring(0, 100)),
    unresolvedThreads: updated.unresolvedThreads.map((t: string) => t.substring(0, 200)),
    lastEvents: updated.lastEvents.substring(0, 500),
    topicSummaries: updated.topicSummaries.map((s: string) => s.substring(0, 200)),
  };
}

// ============================================================================
// 9. TOPIC EXPANSION (heavy) – with fallback
// ============================================================================
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
  },
  userId: string
): Promise<any[]> {
  const storySummary = `
Story so far:
- Characters: ${context.storyContext.characters.join(', ') || 'none yet'}
- Locations: ${context.storyContext.locations.join(', ') || 'none yet'}
- Unresolved threads: ${context.storyContext.unresolvedThreads.join(', ') || 'none'}
- Last events: ${context.storyContext.lastEvents || 'story begins'}
- Previous topics: ${context.storyContext.topicSummaries.join('; ') || 'none'}
`;

  const systemPrompt = `You are drafting Topic ${topic.topicNumber} of ${context.totalTopics} for Chapter ${context.chapterNumber}/${context.totalChapters}.
                 
📖 TOPIC: ${topic.topicTitle}
📊 DIFFICULTY: ${context.difficultyLevel}
🎭 UNIVERSE: ${context.randomTrope}
🎨 TONE: ${context.randomTone}
🌀 TWIST: ${context.randomTwist}
${context.referenceContext}

${storySummary}

🎯 PEDAGOGICAL GOAL: ${topic.pedagogicalGoal}
📝 NARRATIVE BEAT: ${topic.narrativeBeat}

⚡ STRICT CONTENT REQUIREMENTS:
1. ${context.focusModeDirectives}
2. Generate 6-10 content blocks mixing different types:
   - 2-3 STORY blocks (4-5 paragraphs each, highly engaging)
   - 2-3 FACT blocks (key concepts with examples)
   - 2 QUIZ blocks of varying types: single MCQ, multiple MCQ, true/false, or short answer
   - 1-2 DEFINITION blocks (key terms)
   - 1-2 IMAGE blocks (visual concepts with detailed prompts)
   - 1 CODE block if applicable (with working examples)
   - 1 SUMMARY block (key takeaways)
3. Weave student's hobbies (${context.safeHobbies}) and interests (${context.safeInterests}) into stories and examples.
4. For ${context.difficultyLevel} level: ${
    context.difficultyLevel === 'beginner' 
      ? 'Use simple analogies, step-by-step explanations, and relatable examples.' 
      : context.difficultyLevel === 'intermediate' 
      ? 'Include practical applications, case studies, and real-world examples.' 
      : 'Include advanced theories, research papers, edge cases, and cutting-edge developments.'
  }
5. DO NOT repeat content from previous topics or chapters.
6. Each story block MUST be 4-5 paragraphs minimum.
7. For quizzes:
   - Single MCQ: provide 4 options and one correct answer.
   - Multiple MCQ: provide 4-5 options and 2-3 correct answers.
   - True/False: provide options ["True","False"] and correctAnswer as "True" or "False".
   - Short answer: provide correctAnswer and optional keywords.
8. Image prompts must be highly descriptive for AI image generation.`;

  const prompt = `Write deep, detailed content blocks for Topic ${topic.topicNumber}: "${topic.topicTitle}" of "${context.chapterTitle}".

This is Chapter ${context.chapterNumber} of ${context.totalChapters}. Build upon previous knowledge and the ongoing story.

Return ONLY valid JSON with a "blocks" array containing 6-10 content blocks.`;

  const result = await callWithFallback(async (provider, model) => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: provider === 'groq' ? groq(model) : google(model),
        providerOptions: provider === 'groq' ? {
          groq: {
            structuredOutputs: false,
            response_format: { type: 'json_object' },
          },
        } : undefined,
        system: systemPrompt,
        prompt,
        schema: TopicExpansionSchema,
        temperature: 0.75,
      }),
      60000
    );
    if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
    return object;
  }, 'heavy'); // heavy task

  return result.blocks;
}

// ============================================================================
// 10. THE MASTER TUTOR ENGINE (unchanged, but uses updated helpers)
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
            groq: {
              structuredOutputs: false,
              response_format: { type: 'json_object' },
            },
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
    }, 'light'); // blueprint is a lighter task

    if (!blueprint.topics || blueprint.topics.length === 0) {
      throw new Error('Blueprint generation returned zero topics');
    }

    chapterCache.set(cacheKey, {
      blueprint,
      context: cached?.context,
      expiresAt: now + CACHE_TTL,
    });
  }

  // PHASE 2: TOPIC EXPANSION with narrative context
  let storyContext: StoryContext = cached?.context || {
    characters: [],
    locations: [],
    unresolvedThreads: [],
    lastEvents: '',
    topicSummaries: [],
  };

  console.log(`[Orchestrator] Phase 2: Expanding ${blueprint.topics.length} topics for "${chapterTitle}" sequentially...`);
  let allBlocks: any[] = [];
  let successfulTopics = 0;

  for (const topic of blueprint.topics) {
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
      }, userId);

      allBlocks.push(...blocks);
      successfulTopics++;

      storyContext = await updateStoryContext(userId, storyContext, blocks, topic.topicTitle);
      
      chapterCache.set(cacheKey, {
        blueprint,
        context: storyContext,
        expiresAt: now + CACHE_TTL,
      });
    } catch (error) {
      console.error(`[Orchestrator] ⚠️ Topic ${topic.topicNumber} of "${chapterTitle}" failed after retries:`, error);
    }
  }

  if (successfulTopics < Math.ceil(blueprint.topics.length / 2)) {
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
  
  return { 
    blocks: finalBlocks,
    totalTopics: blueprint.topics.length,
    totalEstimatedMinutes: blueprint.totalEstimatedMinutes,
  };
}

// ============================================================================
// 11. EVALUATION ENGINE – with fallback
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
          groq: {
            structuredOutputs: false,
            response_format: { type: 'json_object' },
          },
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
  }, 'light');
}