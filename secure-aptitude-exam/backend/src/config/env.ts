import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  REDIS_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string(),
  MFA_ISSUER: z.string().default('SecureAptitudeExam'),
  BCRYPT_ROUNDS: z.string().default('12'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  OTP_EXPIRY_MINUTES: z.string().default('10'),
  CERT_SECRET_HASH: z.string(),
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_SIZE_MB: z.string().default('10'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
