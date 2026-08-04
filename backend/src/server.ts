import dotenv from 'dotenv';

// Load env before anything reads process.env at module scope.
dotenv.config();

/* eslint-disable import/first */
import app from './app';
import prisma from './db/prisma';

/**
 * SERVER BOOTSTRAP
 *
 * All routing and middleware live in app.ts. This file only owns the process:
 * start listening, and shut down cleanly.
 */

/**
 * Serverless platforms (Vercel) import this module and drive the exported
 * handler themselves — there is no long-lived process to own. Calling
 * process.exit() or app.listen() there crashes the function on every cold
 * start, which surfaces as an opaque 500 on *every* route, health check
 * included.
 */
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
const weakSecret =
    process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET ?? '').length < 32;

if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
}
if (weakSecret) {
    console.error('JWT_SECRET must be at least 32 characters in production.');
}

// Fail fast when we own the process, so a misconfigured container never starts
// and silently serves traffic. Under serverless we only log: exiting would take
// the whole function down and hide the reason.
if ((missing.length > 0 || weakSecret) && !IS_SERVERLESS) {
    process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;

if (!IS_SERVERLESS) {
    const server = app.listen(PORT, () => {
        console.log(`🚀 API listening on http://localhost:${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/health`);
    });

    registerShutdownHandlers(server);
}

function registerShutdownHandlers(server: import('http').Server) {
    async function shutdown(signal: string) {
        console.log(`${signal} received, shutting down...`);
        server.close(async () => {
            await prisma.$disconnect();
            process.exit(0);
        });

        // Don't hang forever on stuck connections.
        setTimeout(() => process.exit(1), 10_000).unref();
    }

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

export default app;
