import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Existing rate limiters (unchanged)
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
  chapterGeneration: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1h'), prefix: 'ratelimit:chapter' }),
};

// 🔥 NEW: Provider‑specific request rate limiters (RPM)
export const providerRateLimiters = {
  gemini: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),  // Gemini free tier: 20 RPM
    analytics: true,
    prefix: 'ratelimit:provider:gemini',
  }),
  groq: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),   // Groq free tier: 30 RPM
    analytics: true,
    prefix: 'ratelimit:provider:groq',
  }),
};

// Helper to check provider rate limit (use a global identifier or user ID)
export async function checkProviderRateLimit(
  provider: 'gemini' | 'groq',
  identifier: string = 'global'
): Promise<{ success: boolean; reset: number }> {
  const limiter = providerRateLimiters[provider];
  const result = await limiter.limit(identifier);
  return { success: result.success, reset: result.reset };
}

// (Existing helpers unchanged)
export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining, reset: result.reset };
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
}

// Token budget (adjust as needed)
export const TOKEN_BUDGET = {
  daily: 100000,          // Groq free tier daily limit (increase if using paid)
  buffer: 5000,
  perChapter: {
    blueprint: 1200,
    perTopic: 1500,
    maxTopics: 6,
  },
};

// Token helpers (unchanged)
function getTokenKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `tokens:${userId}:${today}`;
}

export async function canSpendTokens(userId: string, estimatedTokens: number): Promise<boolean> {
  const key = getTokenKey(userId);
  const used = (await redis.get<number>(key)) || 0;
  return used + estimatedTokens + TOKEN_BUDGET.buffer <= TOKEN_BUDGET.daily;
}

export async function recordTokenUsage(userId: string, tokensUsed: number) {
  const key = getTokenKey(userId);
  await redis.incrby(key, tokensUsed);
  await redis.expire(key, 60 * 60 * 48);
}

export async function getRemainingTokens(userId: string): Promise<number> {
  const key = getTokenKey(userId);
  const used = (await redis.get<number>(key)) || 0;
  return Math.max(0, TOKEN_BUDGET.daily - used - TOKEN_BUDGET.buffer);
}