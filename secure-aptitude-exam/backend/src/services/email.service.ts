import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT),
  secure: env.SMTP_PORT === '465',
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

const htmlWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #0f0f1a; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; border: 1px solid #2d2d5e; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 28px; letter-spacing: 1px; }
    .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; }
    .body { padding: 40px; }
    .otp-box { background: rgba(102,126,234,0.15); border: 2px solid #667eea; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 40px; font-weight: 700; color: #a78bfa; letter-spacing: 8px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .footer { background: rgba(0,0,0,0.3); padding: 20px; text-align: center; color: #718096; font-size: 13px; }
    p { line-height: 1.7; color: #cbd5e0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 SecureAptitude</h1>
      <p>Your Intelligent Exam Platform</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SecureAptitude. All rights reserved.</p>
      <p>If you didn't request this email, please ignore it.</p>
    </div>
  </div>
</body>
</html>`;

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    logger.error('Email send failed:', error);
    throw error;
  }
}

export async function sendVerificationEmail(email: string, otp: string, name: string): Promise<void> {
  const content = `
    <h2>Welcome, ${name}! 👋</h2>
    <p>Please verify your email address to activate your account.</p>
    <div class="otp-box">
      <p style="margin:0 0 8px; color:#94a3b8;">Your verification code</p>
      <div class="otp-code">${otp}</div>
      <p style="margin:8px 0 0; color:#94a3b8; font-size:13px;">Expires in 10 minutes</p>
    </div>
    <p>Enter this code on the verification page to complete your registration.</p>`;
  await sendEmail(email, '✉️ Verify Your Email — SecureAptitude', htmlWrapper(content));
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, name: string): Promise<void> {
  const content = `
    <h2>Reset Your Password 🔐</h2>
    <p>Hi ${name}, we received a request to reset your password.</p>
    <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <div style="text-align:center; margin: 32px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <p>If you didn't request a password reset, you can safely ignore this email.</p>`;
  await sendEmail(email, '🔐 Password Reset Request — SecureAptitude', htmlWrapper(content));
}

export async function sendTestReminderEmail(email: string, name: string, testTitle: string, scheduledAt: Date): Promise<void> {
  const content = `
    <h2>Test Reminder ⏰</h2>
    <p>Hi ${name}, you have an upcoming aptitude test!</p>
    <div style="background: rgba(102,126,234,0.1); border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin:0;"><strong>Test:</strong> ${testTitle}</p>
      <p style="margin:8px 0 0;"><strong>Scheduled:</strong> ${scheduledAt.toLocaleString()}</p>
    </div>
    <p>Make sure you are in a quiet environment with a stable internet connection.</p>`;
  await sendEmail(email, `⏰ Test Reminder: ${testTitle} — SecureAptitude`, htmlWrapper(content));
}

export async function sendResultEmail(email: string, name: string, testTitle: string, score: number, total: number, passed: boolean): Promise<void> {
  const percentage = ((score / total) * 100).toFixed(1);
  const content = `
    <h2>Your Results Are Ready! 📊</h2>
    <p>Hi ${name}, here are your results for <strong>${testTitle}</strong>:</p>
    <div class="otp-box">
      <div class="otp-code" style="color: ${passed ? '#10b981' : '#ef4444'}">${percentage}%</div>
      <p style="margin:8px 0 0;">${score} / ${total} marks — ${passed ? '✅ PASSED' : '❌ FAILED'}</p>
    </div>
    <p>Log in to your dashboard to see detailed analytics and insights.</p>`;
  await sendEmail(email, `📊 Results: ${testTitle} — SecureAptitude`, htmlWrapper(content));
}

export async function sendMfaOtpEmail(email: string, otp: string): Promise<void> {
  const content = `
    <h2>Login Verification Code 🔑</h2>
    <p>Use this code to complete your login. It expires in 10 minutes.</p>
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    <p>Never share this code with anyone.</p>`;
  await sendEmail(email, '🔑 Your Login Code — SecureAptitude', htmlWrapper(content));
}
