import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AuthUser } from '../types';
import { requireUser } from '../middleware/auth';
import { UnauthorizedError, ValidationError } from '../middleware/errorHandler';

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});

/** Shape returned to the client for the signed-in user. */
function toSessionUser(user: {
    email: string;
    organizationId: string;
    role: AuthUser['role'];
    branchId: string | null;
    organization: { name: string };
    branch: { name: string } | null;
}) {
    return {
        email: user.email,
        orgId: user.organizationId,
        orgName: user.organization.name,
        role: user.role,
        branchId: user.branchId,
        branchName: user.branch?.name ?? null,
    };
}

export const login = async (req: Request, res: Response) => {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const { email, password } = validation.data;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        // Configuration fault, not a client fault — let the handler return 500.
        throw new Error('JWT_SECRET environment variable is not set');
    }

    const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true, branch: true },
    });

    // Compare against a dummy hash when the user is missing so that a bad email
    // and a bad password take a similar amount of time — no user enumeration.
    const hash = user?.password ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const passwordValid = await bcrypt.compare(password, hash);

    if (!user || !passwordValid) {
        throw new UnauthorizedError('Incorrect email or password');
    }

    const payload: AuthUser = {
        userId: user.id,
        orgId: user.organizationId,
        role: user.role,
        branchId: user.branchId,
    };

    const token = jwt.sign(payload, jwtSecret, {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '24h') as jwt.SignOptions['expiresIn'],
    });

    res.json({ token, user: toSessionUser(user) });
};

/**
 * Re-hydrate the session from the token. The SPA calls this on boot so a
 * revoked or expired session is caught immediately rather than after the first
 * data request fails.
 */
export const me = async (req: Request, res: Response) => {
    const authUser = requireUser(req);

    const user = await prisma.user.findUnique({
        where: { id: authUser.userId },
        include: { organization: true, branch: true },
    });

    if (!user) throw new UnauthorizedError('Session no longer valid');

    res.json({ user: toSessionUser(user) });
};
