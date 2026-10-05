import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../types';
import { ForbiddenError, UnauthorizedError } from './errorHandler';
import prisma from '../db/prisma';

/**
 * AUTHENTICATION MIDDLEWARE
 *
 * Verifies the JWT and attaches the typed payload to the request. Errors are
 * thrown so the central error handler owns the response shape.
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        throw new UnauthorizedError('Access denied: missing bearer token');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        // Configuration fault, not a client fault — surfaces as a 500.
        throw new Error('JWT_SECRET environment variable is not set');
    }

    let decoded: AuthUser;
    try { decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as AuthUser; }
    catch { throw new UnauthorizedError('Session expired or invalid'); }
    if (!decoded.userId || !decoded.orgId) throw new UnauthorizedError('Session expired or invalid');
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, include: { branch: true } });
    if (!user || user.organizationId !== decoded.orgId || user.role !== decoded.role || user.branchId !== (decoded.branchId ?? null)) {
        throw new UnauthorizedError('Session permissions have changed. Please sign in again.');
    }
    if (user.role === UserRole.BRANCH_LEADER && (!user.branch || user.branch.organizationId !== user.organizationId)) {
        throw new ForbiddenError('Branch access is not configured. Contact your administrator.');
    }
    req.user = { userId: user.id, orgId: user.organizationId, role: user.role, branchId: user.branchId };
    next();
  } catch (error) { next(error); }
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
