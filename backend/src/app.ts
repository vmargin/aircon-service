import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler, NotFoundError } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { generalRateLimiter, healthCheckRateLimiter } from './middleware/rateLimiter';
import router from './routes/index';

export function createApp() {
  const app = express();

  // Rate limiting and request logs are only meaningful if we can see the real
  // client IP, which behind Railway/Vercel/Fly means trusting the proxy hop.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set('trust proxy', Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy));
  }

  app.disable('x-powered-by');

  // Security headers. This is a JSON API with no first-party HTML, so the CSP
  // is locked all the way down.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  app.use(compression());

  // 100kb is ample for these payloads; the previous 10mb was an easy DoS lever.
  app.use(express.json({ limit: '100kb' }));

  // CORS: an explicit allow-list, never a wildcard.
  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FRONTEND_URL must be set in production');
    }
    allowedOrigins.push('http://localhost:5173');
  }

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(requestLogger());

  // Health check — before the general limiter so monitors can poll freely.
  app.get('/health', healthCheckRateLimiter, (_req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '2.0.0',
      environment: process.env.NODE_ENV ?? 'development',
    });
  });
  app.get('/api/v1/health', healthCheckRateLimiter, (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  app.use(generalRateLimiter);

  // /api/v1 is canonical. /api is an unversioned alias so already-deployed
  // frontends keep working; point new clients at /api/v1.
  app.use('/api/v1', router);
  app.use('/api', router);

  // 404 — a bare middleware rather than app.use('*'), which breaks under the
  // path-to-regexp version shipped with Express 5.
  app.use((req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
