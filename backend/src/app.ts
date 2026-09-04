import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler, NotFoundError } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { generalRateLimiter, healthCheckRateLimiter } from './middleware/rateLimiter';
import router from './routes/index';

/**
 * Locate the built frontend, if there is one.
 *
 * Serving the SPA from this same process means the whole app deploys as ONE
 * service on ONE origin: no second host to configure, and no CORS at all
 * (the browser calls /api/v1 on the page's own origin). When the bundle is
 * absent — e.g. local dev, where Vite serves it on :5173 — we stay a pure API.
 */
function findClientDist(): string | null {
    const candidates = [
        process.env.CLIENT_DIST_PATH,
        // dist/src/app.js → repo root (compiled)
        path.resolve(__dirname, '../../../frontend/dist'),
        // src/app.ts → repo root (ts-node)
        path.resolve(__dirname, '../../frontend/dist'),
    ].filter((p): p is string => Boolean(p));

    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    }
    return null;
}

export function createApp() {
    const app = express();
    const clientDist = findClientDist();

    // Rate limiting and request logs are only meaningful if we can see the real
    // client IP, which behind Railway/Render/Fly means trusting the proxy hop.
    const trustProxy = process.env.TRUST_PROXY;
    if (trustProxy) {
        app.set('trust proxy', Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy));
    }

    app.disable('x-powered-by');

    // When we serve HTML we need a CSP that permits our own bundle; an API-only
    // deployment gets the maximally strict one.
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: clientDist
                    ? {
                          defaultSrc: ["'self'"],
                          scriptSrc: ["'self'"],
                          styleSrc: ["'self'", "'unsafe-inline'"],
                          imgSrc: ["'self'", 'data:'],
                          fontSrc: ["'self'", 'data:'],
                          connectSrc: ["'self'"],
                          objectSrc: ["'none'"],
                          frameAncestors: ["'none'"],
                      }
                    : { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
            },
            crossOriginResourcePolicy: { policy: 'same-site' },
        })
    );

    app.use(compression());

    // 100kb is ample for these payloads; the previous 10mb was an easy DoS lever.
    app.use(express.json({ limit: '100kb' }));

    // CORS is only relevant when the frontend lives on another origin. Same-origin
    // deployments need no configuration, which removes the single most common
    // way to get a "working" deploy that the browser still refuses to talk to.
    const allowedOrigins = (process.env.FRONTEND_URL ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    if (allowedOrigins.length === 0 && !clientDist && process.env.NODE_ENV !== 'production') {
        allowedOrigins.push('http://localhost:5173');
    }

    if (allowedOrigins.length > 0) {
        app.use(
            cors({
                origin: allowedOrigins,
                credentials: false,
                methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization'],
            })
        );
    }

    app.use(requestLogger());

    // Health check — before the general limiter so monitors can poll freely, and
    // it reports config problems instead of the process dying on boot, so a bad
    // deployment is diagnosable from the outside.
    app.get(['/health', '/api/v1/health'], healthCheckRateLimiter, (_req, res) => {
        const missing = [
            !process.env.DATABASE_URL && 'DATABASE_URL',
            !process.env.JWT_SECRET && 'JWT_SECRET',
        ].filter((v): v is string => Boolean(v));

        res.status(missing.length > 0 ? 503 : 200).json({
            status: missing.length > 0 ? 'MISCONFIGURED' : 'OK',
            missingConfig: missing,
            servingClient: Boolean(clientDist),
            environment: process.env.NODE_ENV ?? 'development',
            timestamp: new Date().toISOString(),
        });
    });

    // Hashed asset files are immutable; index.html must never be cached or users
    // keep booting a stale bundle that points at deleted chunks. Registered
    // before the rate limiter so page loads don't spend the API budget.
    if (clientDist) {
        app.use(
            express.static(clientDist, {
                index: false,
                setHeaders: (res, filePath) => {
                    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
                        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                    }
                },
            })
        );
    }

    app.use(generalRateLimiter);

    // /api/v1 is canonical; /api is an unversioned alias so an already-deployed
    // frontend keeps working. Point new clients at /api/v1.
    app.use('/api/v1', router);
    app.use('/api', router);

    // Unknown /api path → JSON 404. Anything else → the SPA, so a deep link like
    // /bookings survives a refresh.
    app.use((req, res, next) => {
        if (!clientDist || req.path.startsWith('/api') || req.method !== 'GET') {
            return next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
        }
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(clientDist, 'index.html'));
    });

    app.use(errorHandler);

    return app;
}

const app = createApp();
export default app;
