import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limit configurations
export const rateLimiters = {
  profileRead: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '60 s'),
    analytics: true,
    prefix: 'ratelimit:profile:read',
  }),
  profileWrite: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    analytics: true,
    prefix: 'ratelimit:profile:write',
  }),
  export: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 m'),
    analytics: true,
    prefix: 'ratelimit:export',
  }),
  deleteAccount: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '60 m'),
    analytics: true,
    prefix: 'ratelimit:delete',
  }),
  avatar: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 m'),
    analytics: true,
    prefix: 'ratelimit:avatar',
  }),
  achievements: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    analytics: true,
    prefix: 'ratelimit:achievements',
  }),
  curriculum: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 m'),
    analytics: true,
    prefix: 'ratelimit:curriculum',
  }),
  assessment: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '60 m'),
    analytics: true,
    prefix: 'ratelimit:assessment',
  }),
  doubts: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '60 m'),
    analytics: true,
    prefix: 'ratelimit:doubts',
  }),
  chapterGeneration: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1h') }), 
};

export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset, // Use 'reset', as 'resetIn' doesn't exist on the native Upstash object
  };
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded 
    ? forwarded.split(',')[0].trim() 
    : req.headers.get('x-real-ip') || 'unknown';
}