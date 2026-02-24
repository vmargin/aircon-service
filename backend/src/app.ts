import express from 'express';
import cors from 'cors';
import { errorHandler, NotFoundError } from './middleware/errorHandler';
import { requestLogger, auditLogger, healthCheckLogger } from './middleware/requestLogger';
import { sanitizeInput } from './lib/security';
import { loginRateLimiter, publicBookingRateLimiter, healthCheckRateLimiter, generalRateLimiter } from './middleware/rateLimiter';
import router from './routes/index';

export function createApp() {
  const app = express();

  // Security middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Sanitize all inputs
  app.use(sanitizeInput);

  // CORS configuration
  const allowedOrigin = process.env.FRONTEND_URL;
  if (!allowedOrigin && process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_URL must be set in production');
  }

  app.use(cors({
    origin: allowedOrigin || 'http://localhost:5173',
    credentials: false,
  }));

  // Rate limiting
  app.use('/api/v1/auth/login', loginRateLimiter);
  app.use('/api/v1/public/book', publicBookingRateLimiter);
  app.use('/api/v1/health', healthCheckRateLimiter);
  app.use(generalRateLimiter);

  // Request logging
  app.use(requestLogger());

  // Audit logging
  app.use(auditLogger());

  // Health check endpoint
  app.use('/health', healthCheckLogger(), (_req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // API routes
  app.use('/api/v1', router);

  // 404 handler
  app.use('*', (req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.url} not found`));
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;