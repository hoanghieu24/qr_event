import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { otpLimiter, loginLimiter } from '../../middlewares/rateLimit.middleware';

const router = Router();

// Staff & Admin Password login
router.post('/login', loginLimiter, AuthController.login);
router.post('/register', AuthController.register);

// Customer OTP login
router.post('/send-otp', otpLimiter, AuthController.sendOtp);
router.post('/verify-otp', AuthController.verifyOtp);

// Internal SMTP relay nonce verification (for cloud platforms blocking direct SMTP ports)
router.post('/verify-smtp-relay', AuthController.verifySmtpRelay);

// Get current profile
router.get('/me', authenticate, AuthController.getMe);

export default router;
