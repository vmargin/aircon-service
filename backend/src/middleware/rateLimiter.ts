import rateLimit from 'express-rate-limit';

// Rate limiter for login endpoint
export const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts. Please try again later.',
    retryAfter: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for public booking endpoint
export const publicBookingRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 3, // 3 attempts per window (more restrictive)
  message: {
    error: 'Too many booking attempts. Please try again later.',
    retryAfter: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for all other endpoints
export const generalRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for health check (more permissive)
export const healthCheckRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
  max: 60, // 60 requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom rate limiter for specific routes
export function customRateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
}) {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 5,
    message: {
      error: options.message || 'Too many requests. Please try again later.',
      retryAfter: options.windowMs || 900
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}