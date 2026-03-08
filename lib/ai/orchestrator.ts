import { generateObject } from 'ai';
import { z } from 'zod';
import crypto from 'crypto';
import { rateLimiters, checkRateLimit, recordTokenUsage } from '@/lib/rate-limit';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// ============================================================================
// 1. HELPER: SMART EXPONENTIAL BACKOFF WITH ERROR FILTERING
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
        console.error('[Orchestrator] Fatal Schema/Request Error. Bypassing retries.', error);
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
      console.warn(`[Orchestrator Retry] Groq API choked (Attempt ${attempt}/${retries}). Retrying in ${Math.round(waitMs / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error('Unreachable');
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
// 4. SCHEMAS
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

const TopicExpansionSchema = z.object({
  blocks: z.array(ContentBlockSchema).min(5).max(10),
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
// 5. KEY TOPIC EXTRACTOR (8B)
// ============================================================================
function getDefaultConceptsForSubject(subjectName: string, classLevel: number): string[] {
  return [`${subjectName} fundamentals`, `${subjectName} core principles`, `${subjectName} advanced topics`];
}

export async function extractBookConcepts(
  bookTitles: string[],
  subjectName: string,
  classLevel: number
): Promise<{ concepts: string[]; foundationalTopics: string[]; advancedTopics: string[] }> {
  console.log(`[Orchestrator] Extracting concepts from ${bookTitles.length} books for ${subjectName}...`);
  
  try {
    const result = await withRetry(async () => {
      const { object, usage } = await withTimeout(
        generateObject({
          model: groq('llama-3.1-8b-instant'),
          providerOptions: {
            groq: {
              structuredOutputs: false,
              response_format: { type: 'json_object' },
            },
          },
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
      if (usage?.totalTokens) await recordTokenUsage('extractBookConcepts', usage.totalTokens);
      return object;
    });
    return result;
  } catch (error) {
    console.error(`[Orchestrator] Concept extraction failed, using fallback.`, error);
    return {
      concepts: getDefaultConceptsForSubject(subjectName, classLevel),
      foundationalTopics: getDefaultConceptsForSubject(subjectName, classLevel).slice(0,5),
      advancedTopics: getDefaultConceptsForSubject(subjectName, classLevel).slice(0,5),
    };
  }
}

// ============================================================================
// 6. CURRICULUM PLANNER (8B)
// ============================================================================
export async function generateCurriculumPlan(
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
  
  const bookConcepts = await extractBookConcepts(referenceBooks, subjectName, classLevel);
  
  const plan = await withRetry(async () => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: groq('llama-3.1-8b-instant'),
        providerOptions: {
          groq: {
            structuredOutputs: false,
            response_format: { type: 'json_object' },
          },
        },
        system: `You are the EduBridge Master Architect. Create a comprehensive curriculum plan.`,
        prompt: `Create a ${totalChapters}-chapter curriculum plan for ${subjectName} (Class ${classLevel}).

Reference Books: ${referenceBooks.join(', ')}

Extracted Concepts:
- All Concepts: ${bookConcepts.concepts.slice(0, 20).join(', ')}...
- Foundational Topics: ${bookConcepts.foundationalTopics.join(', ')}
- Advanced Topics: ${bookConcepts.advancedTopics.join(', ')}

Return a JSON object with chapters, totalEstimatedMinutes, and learningObjectives.`,
        schema: z.object({
          chapters: z.array(z.object({
            chapterNumber: z.number(),
            chapterTitle: z.string(),
            keyTopics: z.array(z.string()).min(3).max(10),
            estimatedMinutes: z.number(),
            difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
          })).min(20).max(40),
          totalEstimatedMinutes: z.number(),
          learningObjectives: z.array(z.string()),
        }),
        temperature: 0.5,
      }),
      60000
    );
    if (usage?.totalTokens) await recordTokenUsage('generateCurriculumPlan', usage.totalTokens);
    return object;
  });
  
  console.log(`[Orchestrator] ✅ Generated ${plan.chapters.length} chapter plan for ${subjectName}`);
  return plan;
}

// ============================================================================
// 7. TOPIC EXPANSION (70B for high‑quality stories)
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
  },
  userId: string
): Promise<any[]> {
  const blocks = await withRetry(async () => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: groq('llama-3.3-70b-versatile'),
        providerOptions: {
          groq: {
            structuredOutputs: false,
            response_format: { type: 'json_object' },
          },
        },
        system: `You are drafting Topic ${topic.topicNumber} of ${context.totalTopics} for Chapter ${context.chapterNumber}/${context.totalChapters}.
                 
                 📖 TOPIC: ${topic.topicTitle}
                 📊 DIFFICULTY: ${context.difficultyLevel}
                 🎭 UNIVERSE: ${context.randomTrope}
                 🎨 TONE: ${context.randomTone}
                 🌀 TWIST: ${context.randomTwist}
                 ${context.referenceContext}
                 
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
                 8. Image prompts must be highly descriptive for AI image generation.`,
        prompt: `Write deep, detailed content blocks for Topic ${topic.topicNumber}: "${topic.topicTitle}" of "${context.chapterTitle}".

This is Chapter ${context.chapterNumber} of ${context.totalChapters}. Build upon previous knowledge progressively.

Return ONLY valid JSON with a "blocks" array containing 6-10 content blocks.`,
        schema: TopicExpansionSchema,
        temperature: 0.75,
      }),
      60000
    );
    if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
    return object.blocks;
  }, 3, 3000);
  return blocks;
}

// ============================================================================
// 8. THE MASTER TUTOR ENGINE
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

  const safeHobbies = profile.hobbies?.length ? profile.hobbies.join(', ') : 'technology and adventure';
  const safeInterests = profile.interests?.length ? profile.interests.join(', ') : 'general knowledge';
  
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

  const contextBlock = `
    🎓 Student Profile:
    - Grade/Class: ${profile.classLevel || 10}
    - Age: ${profile.age || 'unknown'}
    - Hobbies: ${safeHobbies}
    - Interests: ${safeInterests}
    - Learning Tempo: ${profile.learningTempo}
    
    📖 Chapter Context:
    - Chapter: ${chapterNumber} of ${totalChapters} (${difficultyLevel} level)
    - Topic: ${chapterTitle}
    - Subject: ${subjectName}
    - Previous: ${previousChapterTitle || 'START OF CURRICULUM'}
    - Next: ${nextChapterTitle || 'END OF CURRICULUM'}
    
    🎭 Narrative Elements:
    - Universe: "${randomTrope}"
    - Tone: "${randomTone}"
    - Twist: "${randomTwist}"
    
    ${focusModeDirectives}
    ${referenceContext}
    
    ⚠️ IMPORTANT RULES:
    1. This chapter must be UNIQUE and not repeat content from previous chapters.
    2. Build upon prior knowledge progressively.
    3. Weave student's hobbies (${safeHobbies}) and interests (${safeInterests}) into examples, analogies, and story characters.
    4. Each topic should have 5-10 content blocks mixing stories, facts, quizzes, definitions, and images.
    5. Stories must be LONG (4-5 paragraphs minimum) and highly engaging.
    6. Include at least 2 quizzes per topic with detailed explanations. Use a mix of quiz types: single-answer MCQ, multiple-answer MCQ, true/false, and short answer.
    7. Generate image prompts for visual concepts.
  `;

  // ==========================================================================
  // PHASE 1: CHAPTER BLUEPRINT (8B)
  // ==========================================================================
  console.log(`[Orchestrator] Phase 1: Creating chapter blueprint for "${chapterTitle}"...`);
  const blueprint = await withRetry(async () => {
    const { object, usage } = await withTimeout(
      generateObject({
        model: groq('llama-3.1-8b-instant'),
        providerOptions: {
          groq: {
            structuredOutputs: false,
            response_format: { type: 'json_object' },
          },
        },
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

${contextBlock}

Return ONLY valid JSON.`,
        schema: ChapterBlueprintSchema,
        temperature: 0.2,
      }),
      45000
    );
    if (usage?.totalTokens) await recordTokenUsage(userId, usage.totalTokens);
    return object;
  });

  // ==========================================================================
  // PHASE 2: TOPIC EXPANSION (SEQUENTIAL, 70B)
  // ==========================================================================
  console.log(`[Orchestrator] Phase 2: Expanding ${blueprint.topics.length} topics for "${chapterTitle}" sequentially...`);
  let allBlocks: any[] = [];
  let successfulTopics = 0;

  for (const topic of blueprint.topics) {
    try {
      const blocks = await expandTopic(topic, {
        chapterNumber,
        totalChapters,
        chapterTitle,
        totalTopics: blueprint.topics.length,  // pass total topics
        difficultyLevel,
        randomTrope,
        randomTone,
        randomTwist,
        referenceContext,
        focusModeDirectives,
        safeHobbies,
        safeInterests,
      }, userId);
      allBlocks.push(...blocks);
      successfulTopics++;
    } catch (error) {
      console.error(`[Orchestrator] ⚠️ Topic ${topic.topicNumber} of "${chapterTitle}" failed after retries:`, error);
    }
  }

  if (successfulTopics < Math.ceil(blueprint.topics.length / 2)) {
    throw new Error(`CRITICAL: Majority of topics failed for "${chapterTitle}". Aborting chapter generation.`);
  }

  // ==========================================================================
  // PHASE 3: ASSEMBLY & IMAGE URLS
  // ==========================================================================
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
// 9. EVALUATION ENGINE (8B)
// ============================================================================
export async function evaluateAnswer(
  question: { type: string; correctAnswer: string | string[]; keywords?: string[] },
  userAnswer: string,
  context: string
) {
  return await withRetry(async () => {
    const { object, usage } = await generateObject({
      model: groq('llama-3.1-8b-instant'),
      providerOptions: {
        groq: {
          structuredOutputs: false,
          response_format: { type: 'json_object' },
        },
      },
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
    });
    if (usage?.totalTokens) await recordTokenUsage('evaluateAnswer', usage.totalTokens);
    return object;
  }, 2, 1000);
}