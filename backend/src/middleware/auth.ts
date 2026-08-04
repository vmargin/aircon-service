import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../types';
import { ForbiddenError, UnauthorizedError } from './errorHandler';

/**
 * AUTHENTICATION MIDDLEWARE
 *
 * Verifies the JWT and attaches the typed payload to the request. Errors are
 * thrown so the central error handler owns the response shape.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        throw new UnauthorizedError('Access denied: missing bearer token');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        // Configuration fault, not a client fault — surfaces as a 500.
        throw new Error('JWT_SECRET environment variable is not set');
    }

    try {
        const decoded = jwt.verify(token, jwtSecret) as AuthUser;
        req.user = decoded;
        next();
    } catch {
        throw new UnauthorizedError('Session expired or invalid');
    }
};

/** Require the caller to hold one of the given roles. */
export const requireRole =
    (...roles: UserRole[]) =>
    (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) throw new UnauthorizedError();
        if (!roles.includes(req.user.role)) {
            throw new ForbiddenError('You do not have permission to perform this action');
        }
        next();
    };

/**
 * Narrow `req.user` to non-undefined. Routes behind `authenticate` always have
 * it, but TypeScript cannot know that.
 */
export function requireUser(req: Request): AuthUser {
    if (!req.user) throw new UnauthorizedError();
    return req.user;
}

export default authenticate;
