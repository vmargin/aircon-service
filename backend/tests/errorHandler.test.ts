import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { redact, AppError, NotFoundError, ValidationError, errorHandler } from '../src/middleware/errorHandler';

describe('redact', () => {
    it('masks passwords so failed logins do not leak credentials', () => {
        expect(redact({ email: 'a@b.com', password: 'hunter2' })).toEqual({
            email: 'a@b.com',
            password: '[REDACTED]',
        });
    });

    it('is case-insensitive and covers tokens', () => {
        expect(redact({ Authorization: 'Bearer x', newPassword: 'p' })).toEqual({
            Authorization: '[REDACTED]',
            newPassword: '[REDACTED]',
        });
    });

    it('recurses into nested objects and arrays', () => {
        expect(redact({ users: [{ name: 'a', password: 'p' }] })).toEqual({
            users: [{ name: 'a', password: '[REDACTED]' }],
        });
    });

    it('passes through primitives untouched', () => {
        expect(redact('plain')).toBe('plain');
        expect(redact(null)).toBeNull();
    });
});

describe('AppError', () => {
    it('carries the HTTP status', () => {
        expect(new NotFoundError().status).toBe(404);
        expect(new ValidationError('bad').status).toBe(400);
        expect(new AppError('boom', 503).status).toBe(503);
    });
});

describe('Prisma transaction errors', () => {
    const invokeHandler = (code: string) => {
        const error = new Prisma.PrismaClientKnownRequestError('transaction failed', {
            code,
            clientVersion: Prisma.prismaVersion.client,
        });
        const response = {
            setHeader: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const warningLog = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            errorHandler(error, { method: 'POST', originalUrl: '/api/v1/test', body: {} } as Request, response as unknown as Response, jest.fn());
        } finally {
            errorLog.mockRestore();
            warningLog.mockRestore();
        }
        return response;
    };

    it('reports transaction and pool timeouts as retryable service unavailability', () => {
        for (const code of ['P2024', 'P2028']) {
            const response = invokeHandler(code);
            expect(response.status).toHaveBeenCalledWith(503);
            expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '1');
            expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'The database is busy completing this change. Please retry in a moment.',
            }));
        }
    });

    it('keeps transaction write conflicts as 409', () => {
        const response = invokeHandler('P2034');
        expect(response.status).toHaveBeenCalledWith(409);
        expect(response.setHeader).not.toHaveBeenCalled();
    });
});
