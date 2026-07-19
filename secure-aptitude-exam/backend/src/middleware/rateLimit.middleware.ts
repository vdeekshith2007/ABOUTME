import { rateLimit } from 'express-rate-limit';
import { redis } from '../config/redis';
import { env } from '../config/env';

// General API rate limit
export const generalLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// OTP generation limit
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Try again in 1 hour.' },
});

// API limit for exam submissions
export const examLimiter = rateLimit({
  windowMs: 1000, // 1 sec
  max: 10,
  message: { success: false, message: 'Too many exam requests.' },
});

// Progressive delay for failed logins (Redis-based)
export async function trackFailedLogin(ip: string): Promise<number> {
  const key = `failed_login:${ip}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, 900); // 15 min window
  return attempts;
}

export async function resetFailedLogin(ip: string): Promise<void> {
  await redis.del(`failed_login:${ip}`);
}

export async function getFailedLoginAttempts(ip: string): Promise<number> {
  const val = await redis.get(`failed_login:${ip}`);
  return val ? parseInt(val) : 0;
}
