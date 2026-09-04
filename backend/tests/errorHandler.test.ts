import { redact, AppError, NotFoundError, ValidationError } from '../src/middleware/errorHandler';

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
