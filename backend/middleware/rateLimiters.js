import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

const TRUSTED_PROXIES = ['127.0.0.1', '::1'];
const isTrustedProxy = (ip) => ip === '127.0.0.1' || ip === '::1';



export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, 
  delayAfter: 30, 
  delayMs: (hits) => hits * 100,
  maxDelayMs: 5000,
  trustProxy: isTrustedProxy
});



export const createApiLimiter = (windowMinutes = 15, max = 300) => rateLimit({
  windowMs: Number(windowMinutes) * 60 * 1000 || 15 * 60 * 1000,
  max: Number(max) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: isTrustedProxy,
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: (req) => req.ip,
  skip: (req) => req.method === 'GET' && req.path.includes('/api/public')
});



export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {

    const username = req.body?.username || req.body?.email || '';
    return `login:${username.toLowerCase()}:${req.ip}`;
  },
  trustProxy: isTrustedProxy
});



export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 3, 
  message: 'Too many password reset requests. Please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    return `reset:${email.toLowerCase()}:${req.ip}`;
  },
  trustProxy: isTrustedProxy
});



export const accountCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many account creation attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const identifier = (req.body?.email || req.body?.username || '')
      .toString()
      .toLowerCase()
      .trim();
    return identifier ? `create:${identifier}:${req.ip}` : `ip:${req.ip}`;
  },
  trustProxy: isTrustedProxy
});



export const writeOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: 'Too many write operations. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  keyGenerator: (req) => {
    const userId = req.user?.user_id || req.user?.id || req.user?.userId;
    if (userId) return `user:${String(userId)}`;
    return `ip:${req.ip}`;
  },
  trustProxy: isTrustedProxy
});


