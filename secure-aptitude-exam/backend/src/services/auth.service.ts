import argon2 from 'argon2';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import speakeasy from 'speakeasy';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import {
  generateAccessToken,
  generateRefreshToken,
  blacklistToken,
} from '../middleware/auth.middleware';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendMfaOtpEmail,
} from './email.service';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/errors';
import { logger } from '../utils/logger';
import { Role } from '@prisma/client';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── REGISTER ──────────────────────────────────────────────────────────────────

export async function registerUser(data: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  college?: string;
  phone?: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
  });
  if (existing) {
    throw new ConflictError(
      existing.email === data.email ? 'Email already registered' : 'Username already taken'
    );
  }

  const passwordHash = await argon2.hash(data.password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + parseInt(env.OTP_EXPIRY_MINUTES) * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      college: data.college,
      phone: data.phone,
      emailOtp: otp,
      emailOtpExpiresAt: otpExpiry,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  await sendVerificationEmail(user.email, otp, user.firstName);

  logger.info(`New user registered: ${user.email}`);
  return user;
}

// ─── VERIFY EMAIL ──────────────────────────────────────────────────────────────

export async function verifyEmail(email: string, otp: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new NotFoundError('User not found');
  if (user.isEmailVerified) throw new ValidationError('Email already verified');
  if (!user.emailOtp || user.emailOtp !== otp) throw new ValidationError('Invalid OTP');
  if (!user.emailOtpExpiresAt || user.emailOtpExpiresAt < new Date()) {
    throw new ValidationError('OTP has expired');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailOtp: null, emailOtpExpiresAt: null },
  });

  return { message: 'Email verified successfully' };
}

// ─── RESEND OTP ─────────────────────────────────────────────────────────────

export async function resendVerificationOtp(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new NotFoundError('User not found');
  if (user.isEmailVerified) throw new ValidationError('Email already verified');

  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + parseInt(env.OTP_EXPIRY_MINUTES) * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailOtp: otp, emailOtpExpiresAt: otpExpiry },
  });

  await sendVerificationEmail(email, otp, user.firstName);
  return { message: 'OTP sent successfully' };
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid credentials');
  if (!user.isEmailVerified) throw new UnauthorizedError('Please verify your email first');
  if (user.isBanned) throw new UnauthorizedError(`Account banned: ${user.banReason}`);
  if (!user.isActive) throw new UnauthorizedError('Account is deactivated');

  const isValid = await argon2.verify(user.passwordHash, password);
  if (!isValid) throw new UnauthorizedError('Invalid credentials');

  // If MFA is enabled, return mfaRequired flag
  if (user.mfaEnabled) {
    const tempToken = generateSecureToken();
    await redis.setex(`mfa_pending:${tempToken}`, 300, user.id);
    return { mfaRequired: true, tempToken };
  }

  const tokens = await createTokens(user, ipAddress, userAgent);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
  });

  return { mfaRequired: false, ...tokens, user: sanitizeUser(user) };
}

// ─── MFA VERIFY ─────────────────────────────────────────────────────────────

export async function verifyMfaLogin(tempToken: string, code: string, ipAddress?: string) {
  const userId = await redis.get(`mfa_pending:${tempToken}`);
  if (!userId) throw new UnauthorizedError('MFA session expired');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaSecret) throw new UnauthorizedError('Invalid MFA session');

  // Try TOTP first
  const totpValid = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: code,
    window: parseInt(env.MFA_WINDOW),
  });

  // Fallback: email OTP
  let emailOtpValid = false;
  if (!totpValid) {
    emailOtpValid = user.emailOtp === code && !!user.emailOtpExpiresAt && user.emailOtpExpiresAt > new Date();
  }

  if (!totpValid && !emailOtpValid) throw new UnauthorizedError('Invalid MFA code');

  await redis.del(`mfa_pending:${tempToken}`);
  const tokens = await createTokens(user, ipAddress);
  return { ...tokens, user: sanitizeUser(user) };
}

// ─── GOOGLE AUTH ─────────────────────────────────────────────────────────────

export async function googleAuth(idToken: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new UnauthorizedError('Invalid Google token');

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
  });

  if (!user) {
    const username = `${payload.given_name?.toLowerCase()}_${Date.now()}`;
    user = await prisma.user.create({
      data: {
        email: payload.email,
        username,
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        googleId: payload.sub,
        avatarUrl: payload.picture,
        isEmailVerified: true,
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub, isEmailVerified: true },
    });
  }

  const tokens = await createTokens(user);
  return { ...tokens, user: sanitizeUser(user) };
}

// ─── FORGOT / RESET PASSWORD ──────────────────────────────────────────────────

export async function forgotPassword(email: string, resetBaseUrl: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { message: 'If the email exists, a reset link has been sent.' };

  const token = generateSecureToken();
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const resetUrl = `${resetBaseUrl}/reset-password?token=${token}`;
  await sendPasswordResetEmail(email, resetUrl, user.firstName);
  return { message: 'If the email exists, a reset link has been sent.' };
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });
  if (!user) throw new ValidationError('Invalid or expired reset token');

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  return { message: 'Password reset successfully' };
}

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

export async function refreshTokens(refreshToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const tokens = await createTokens(stored.user);
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { isRevoked: true } });
  return tokens;
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

export async function logout(userId: string, accessToken: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });
  await blacklistToken(accessToken, 900);
}

// ─── SETUP MFA ────────────────────────────────────────────────────────────────

export async function setupMfa(userId: string) {
  const secret = speakeasy.generateSecret({ name: `SecureAptitude (${userId})`, issuer: env.MFA_ISSUER });
  await redis.setex(`mfa_setup:${userId}`, 600, secret.base32);
  return { secret: secret.base32, otpauthUrl: secret.otpauth_url };
}

export async function confirmMfa(userId: string, code: string) {
  const secret = await redis.get(`mfa_setup:${userId}`);
  if (!secret) throw new ValidationError('MFA setup session expired');

  const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
  if (!valid) throw new ValidationError('Invalid TOTP code');

  const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex'));
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true, mfaSecret: secret, mfaBackupCodes: backupCodes },
  });
  await redis.del(`mfa_setup:${userId}`);
  return { backupCodes };
}

export async function sendEmailMfa(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');
  const otp = generateOtp();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.user.update({ where: { id: userId }, data: { emailOtp: otp, emailOtpExpiresAt: expiry } });
  await sendMfaOtpEmail(user.email, otp);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function createTokens(user: { id: string; email: string; role: Role }, ipAddress?: string, userAgent?: string) {
  const payload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt, deviceInfo: userAgent, ipAddress },
  });

  return { accessToken, refreshToken };
}

function sanitizeUser(user: {
  id: string; email: string; username: string; firstName: string;
  lastName: string; role: Role; avatarUrl: string | null; college: string | null;
  mfaEnabled: boolean; isEmailVerified: boolean;
}) {
  return {
    id: user.id, email: user.email, username: user.username,
    firstName: user.firstName, lastName: user.lastName,
    role: user.role, avatarUrl: user.avatarUrl, college: user.college,
    mfaEnabled: user.mfaEnabled, isEmailVerified: user.isEmailVerified,
  };
}
