import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { env } from '../config/env';
import { prisma } from '../config/database';

// POST /api/auth/register
export async function register(req: Request, res: Response) {
  const user = await authService.registerUser(req.body);
  res.status(201).json({ success: true, message: 'Registration successful. Check your email for OTP.', data: user });
}

// POST /api/auth/verify-email
export async function verifyEmail(req: Request, res: Response) {
  const result = await authService.verifyEmail(req.body.email, req.body.otp);
  res.json({ success: true, ...result });
}

// POST /api/auth/resend-otp
export async function resendOtp(req: Request, res: Response) {
  const result = await authService.resendVerificationOtp(req.body.email);
  res.json({ success: true, ...result });
}

// POST /api/auth/login
export async function login(req: Request, res: Response) {
  const ip = (req.ip || req.socket.remoteAddress || '') as string;
  const ua = (req.headers['user-agent'] || '') as string;
  const result = await authService.loginUser(req.body.email, req.body.password, ip, ua);
  res.json({ success: true, data: result });
}

// POST /api/auth/mfa/verify
export async function verifyMfa(req: Request, res: Response) {
  const result = await authService.verifyMfaLogin(req.body.tempToken, req.body.code, req.ip);
  res.json({ success: true, data: result });
}

// POST /api/auth/mfa/email-otp
export async function sendEmailMfaOtp(req: Request, res: Response) {
  await authService.sendEmailMfa(req.body.userId);
  res.json({ success: true, message: 'OTP sent to email' });
}

// GET /api/auth/google
export async function googleAuth(req: Request, res: Response) {
  const result = await authService.googleAuth(req.body.idToken);
  res.json({ success: true, data: result });
}

// POST /api/auth/refresh
export async function refreshToken(req: Request, res: Response) {
  const result = await authService.refreshTokens(req.body.refreshToken);
  res.json({ success: true, data: result });
}

// POST /api/auth/logout
export async function logout(req: Request, res: Response) {
  const token = req.headers.authorization?.split(' ')[1] || '';
  await authService.logout(req.user!.userId, token);
  res.json({ success: true, message: 'Logged out successfully' });
}

// POST /api/auth/forgot-password
export async function forgotPassword(req: Request, res: Response) {
  const resetBaseUrl = env.FRONTEND_URL;
  const result = await authService.forgotPassword(req.body.email, resetBaseUrl);
  res.json({ success: true, ...result });
}

// POST /api/auth/reset-password
export async function resetPassword(req: Request, res: Response) {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, ...result });
}

// GET /api/auth/me
export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true, email: true, username: true, firstName: true, lastName: true,
      role: true, avatarUrl: true, college: true, phone: true, mfaEnabled: true,
      isEmailVerified: true, createdAt: true, lastLoginAt: true,
    },
  });
  res.json({ success: true, data: user });
}

// GET /api/auth/mfa/setup
export async function setupMfa(req: Request, res: Response) {
  const result = await authService.setupMfa(req.user!.userId);
  res.json({ success: true, data: result });
}

// POST /api/auth/mfa/confirm
export async function confirmMfa(req: Request, res: Response) {
  const result = await authService.confirmMfa(req.user!.userId, req.body.code);
  res.json({ success: true, data: result });
}
