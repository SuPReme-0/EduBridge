// Removed @upstash/ratelimit and @upstash/redis imports
// Removed Redis client initialization

// Mock limiter to completely bypass rate limiting while keeping the same response structure
const dummyLimiter = {
  limit: async (identifier?: string) => ({
    success: true,
    limit: 9999,
    remaining: 9999,
    reset: Date.now() + 60000, // Mock reset time (1 minute from now)
  }),
};

// Existing rate limiters (bypassed)
export const rateLimiters = {
  profileRead: dummyLimiter,
  profileWrite: dummyLimiter,
  export: dummyLimiter,
  deleteAccount: dummyLimiter,
  avatar: dummyLimiter,
  achievements: dummyLimiter,
  curriculum: dummyLimiter,
  assessment: dummyLimiter,
  doubts: dummyLimiter,
  chapterGeneration: dummyLimiter,
};

// 🔥 NEW: Provider‑specific request rate limiters (RPM) (bypassed)
export const providerRateLimiters = {
  gemini: dummyLimiter,
  groq: dummyLimiter,
};

// Helper to check provider rate limit (always returns success)
export async function checkProviderRateLimit(
  provider: 'gemini' | 'groq',
  identifier: string = 'global'
): Promise<{ success: boolean; reset: number }> {
  return { success: true, reset: Date.now() + 60000 };
}

// Existing helper (always returns success)
export async function checkRateLimit(limiter: any, identifier: string) {
  // We call the passed limiter (which is now dummyLimiter) to maintain behavior compatibility
  const result = await limiter.limit(identifier);
  return { success: true, remaining: result.remaining, reset: result.reset };
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
}

// Token budget (kept so files importing it don't break)
export const TOKEN_BUDGET = {
  daily: 100000,          // Groq free tier daily limit (increase if using paid)
  buffer: 5000,
  perChapter: {
    blueprint: 1200,
    perTopic: 1500,
    maxTopics: 6,
  },
};

// Token helpers (logic bypassed to always allow spending and pretend no tokens are used)

export async function canSpendTokens(userId: string, estimatedTokens: number): Promise<boolean> {
  // Always true
  return true;
}

export async function recordTokenUsage(userId: string, tokensUsed: number): Promise<void> {
  // No-op: do nothing since we bypassed Redis
  return;
}

export async function getRemainingTokens(userId: string): Promise<number> {
  // Always return the max possible budget
  return Math.max(0, TOKEN_BUDGET.daily - TOKEN_BUDGET.buffer);
}