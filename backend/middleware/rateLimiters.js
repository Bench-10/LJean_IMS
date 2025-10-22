import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';



export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, 
  delayAfter: 30, 
  delayMs: (hits) => hits * 100,
  maxDelayMs: 5000
});



export const createApiLimiter = (windowMinutes, max) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => {
      return req.method === 'GET' && req.path.includes('/api/public');
    }
  });
};



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
  }
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
  }
});



export const accountCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, 
  message: 'Too many account creation attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});



export const writeOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: 'Too many write operations. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET'
});
