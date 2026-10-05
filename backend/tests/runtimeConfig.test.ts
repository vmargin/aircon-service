import { Server } from 'http';
import { createApp } from '../src/app';

describe('production runtime configuration', () => {
    let server: Server;
    let origin: string;
    let originalEnvironment: Record<string, string | undefined>;

    beforeAll(async () => {
        originalEnvironment = {
            NODE_ENV: process.env.NODE_ENV,
            DATABASE_URL: process.env.DATABASE_URL,
            JWT_SECRET: process.env.JWT_SECRET,
        };
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:5432/arctic_test';
        process.env.JWT_SECRET = 'short-production-secret';

        server = createApp().listen(0, '127.0.0.1');
        await new Promise<void>((resolve) => server.once('listening', resolve));
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Test server did not start');
        origin = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
        if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        for (const [key, value] of Object.entries(originalEnvironment)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it('marks health misconfigured when production JWT_SECRET is too short', async () => {
        const response = await fetch(`${origin}/health`);
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
            status: 'MISCONFIGURED',
            missingConfig: [],
            invalidConfig: ['JWT_SECRET'],
        });
    });

    it('blocks application routes until the production secret is corrected', async () => {
        const response = await fetch(`${origin}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'demo@example.com', password: 'demo1234' }),
        });
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ status: 'MISCONFIGURED' });
    });
});
