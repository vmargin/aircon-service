import rateLimit, { ipKeyGenerator, Options } from 'express-rate-limit';
import { Request } from 'express';

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

function limiter(overrides: Partial<Options>) {
  return rateLimit({
    windowMs: WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    ...overrides,
  });
}

/**
 * Credential stuffing protection. Deliberately strict and keyed on IP, since
 * there is no authenticated identity yet at this point.
 */
export const loginRateLimiter = limiter({
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again later.' },
});

/** Public, unauthenticated write endpoint — abuse target, so keep it tight. */
export const publicBookingRateLimiter = limiter({
  max: Number(process.env.RATE_LIMIT_PUBLIC_BOOKING_MAX) || 10,
  message: { error: 'Too many booking attempts. Please try again later.' },
});

/**
 * General API budget. Keyed per authenticated user where possible so that a
 * whole office behind one NAT address doesn't share a single bucket.
 *
 * The previous value (100 requests / hour, applied globally) was low enough
 * that simply clicking through the dashboard would lock a user out.
 */
export const generalRateLimiter = limiter({
  max: Number(process.env.RATE_LIMIT_GENERAL_MAX) || 600,
  keyGenerator: (req: Request, res) =>
    req.user?.userId ?? ipKeyGenerator(req.ip ?? '', 56) ?? res.statusCode.toString(),
  message: { error: 'Too many requests. Please slow down.' },
});

/** Health checks are polled by uptime monitors; allow generous headroom. */
export const healthCheckRateLimiter = limiter({
  windowMs: 5 * 60 * 1000,
  max: 300,
});
