import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';

/** Keys whose values must never reach a log drain. */
const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'jwt_secret',
  'apikey',
]);

/**
 * Recursively replace sensitive values with '[REDACTED]'.
 * The previous implementation logged `req.body` verbatim, which meant every
 * failed login wrote the user's plaintext password to the server logs.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1);
  }
  return out;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

/**
 * Translate Prisma's error codes into HTTP semantics.
 * Previously a duplicate invoice (unique violation on bookingId) surfaced as an
 * opaque 500 instead of a 409.
 */
function fromPrisma(err: unknown): AppError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const target = (err.meta?.target as string[] | string | undefined) ?? undefined;
    const field = Array.isArray(target) ? target.join(', ') : target;

    switch (err.code) {
      case 'P2002':
        return new ConflictError(
          field ? `A record with this ${field} already exists.` : 'Record already exists.'
        );
      case 'P2003':
        return new ValidationError('Referenced record does not exist.');
      case 'P2025':
        return new NotFoundError('Record not found.');
      default:
        break;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError('Malformed query.');
  }

  return null;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const mapped = fromPrisma(err) ?? (err instanceof AppError ? err : null);
  const status = mapped?.status ?? 500;
  const isServerError = status >= 500;
  const rawMessage = err instanceof Error ? err.message : String(err);

  // Only 5xx is genuinely exceptional; 4xx is routine and shouldn't be noise.
  const log = isServerError ? console.error : console.warn;
  log(
    JSON.stringify({
      level: isServerError ? 'error' : 'warn',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status,
      userId: req.user?.userId,
      orgId: req.user?.orgId,
      message: rawMessage,
      body: redact(req.body),
      ...(isServerError && process.env.NODE_ENV !== 'production'
        ? { stack: err instanceof Error ? err.stack : undefined }
        : {}),
    })
  );

  // Never leak internal messages/stack traces to clients on a 500.
  const message = isServerError
    ? 'Internal server error'
    : mapped?.message ?? rawMessage;

  res.status(status).json({
    error: message,
    ...(mapped?.details ? { details: mapped.details } : {}),
    timestamp: new Date().toISOString(),
  });
}

/** Wrap an async handler so rejected promises reach the error middleware. */
export function catchAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
