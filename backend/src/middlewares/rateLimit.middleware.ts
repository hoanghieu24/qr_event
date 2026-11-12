import rateLimit from 'express-rate-limit';

// Rate limiter for OTP generation/requests: 10 requests per 15 minutes
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  },
});

// Chống dò mã OTP: tối đa 15 lần nhập sai / 15 phút cho mỗi email (theo IP + email)
export const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email || '').trim().toLowerCase()}`,
  message: {
    success: false,
    message: 'Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  },
});

// Rate limiter for QR check-in scans: 120 scans per minute per staff
export const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Thao tác quét QR quá nhanh. Vui lòng giãn cách thời gian giữa các lần quét.',
  },
});

// Rate limiter for Staff/Admin Login: relaxed for testing and cloudflare tunnel
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.',
  },
});

// Rate limiter for customer registration: 100 requests per 5 minutes
export const registerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Thao tác đăng ký quá dồn dập. Vui lòng thử lại sau ít phút.',
  },
});

// General API rate limiter: 3000 requests per 5 minutes
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu đến máy chủ. Vui lòng thử lại sau ít phút.',
  },
});
