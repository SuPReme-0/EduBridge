import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis (reused for token counters)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limit configurations (unchanged)
export const rateLimiters = {
  profileRead: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '60 s'), analytics: true, prefix: 'ratelimit:profile:read' }),
  profileWrite: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 s'), analytics: true, prefix: 'ratelimit:profile:write' }),
  export: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 m'), analytics: true, prefix: 'ratelimit:export' }),
  deleteAccount: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '60 m'), analytics: true, prefix: 'ratelimit:delete' }),
  avatar: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 m'), analytics: true, prefix: 'ratelimit:avatar' }),
  achievements: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), analytics: true, prefix: 'ratelimit:achievements' }),
  curriculum: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 m'), analytics: true, prefix: 'ratelimit:curriculum' }),
  assessment: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 m'), analytics: true, prefix: 'ratelimit:assessment' }),
  doubts: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 m'), analytics: true, prefix: 'ratelimit:doubts' }),
  // This is now a fallback; we'll use token budgeting for more precise control
  chapterGeneration: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1h'), prefix: 'ratelimit:chapter' }),
};

export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining, reset: result.reset };
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
}

// ============================================================================
// TOKEN BUDGET UTILITIES (shared across jobs)
// ============================================================================
export const TOKEN_BUDGET = {
  daily: 100000,          // Groq free tier daily limit
  buffer: 5000,           // safety margin
  perChapter: {
    blueprint: 1200,      // estimated tokens for blueprint (8B model)
    perTopic: 1500,       // estimated per topic
    maxTopics: 6,
  },
};

/**
 * Get the Redis key for daily token usage of a user.
 */
function getTokenKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `tokens:${userId}:${today}`;
}

/**
 * Check if a user has enough daily tokens for an estimated cost.
 */
export async function canSpendTokens(userId: string, estimatedTokens: number): Promise<boolean> {
  const key = getTokenKey(userId);
  const used = (await redis.get<number>(key)) || 0;
  return used + estimatedTokens + TOKEN_BUDGET.buffer <= TOKEN_BUDGET.daily;
}

/**
 * Record actual token usage after a successful API call.
 */
export async function recordTokenUsage(userId: string, tokensUsed: number) {
  const key = getTokenKey(userId);
  await redis.incrby(key, tokensUsed);
  // Set expiry to 48 hours so counters auto‑clean
  await redis.expire(key, 60 * 60 * 48);
}

/**
 * Get the remaining tokens for a user today.
 */
export async function getRemainingTokens(userId: string): Promise<number> {
  const key = getTokenKey(userId);
  const used = (await redis.get<number>(key)) || 0;
  return Math.max(0, TOKEN_BUDGET.daily - used - TOKEN_BUDGET.buffer);
}