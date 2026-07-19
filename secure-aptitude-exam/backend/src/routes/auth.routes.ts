import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/register', authLimiter, authController.register);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-otp', otpLimiter, authController.resendOtp);
router.post('/login', authLimiter, authController.login);
router.post('/mfa/verify', authLimiter, authController.verifyMfa);
router.post('/mfa/email-otp', otpLimiter, authController.sendEmailMfaOtp);
router.post('/google', authController.googleAuth);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authenticate, authController.getMe);
router.get('/mfa/setup', authenticate, authController.setupMfa);
router.post('/mfa/confirm', authenticate, authController.confirmMfa);

export default router;
