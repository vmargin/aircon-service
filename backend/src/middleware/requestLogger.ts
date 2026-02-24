import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';

// Create request logging middleware
export function requestLogger() {
  const format = process.env.NODE_ENV === 'production' ? 'tiny' : 'dev';

  return morgan(format, {
    skip: (req: Request, _res: Response) => {
      // Skip health checks and static files in production
      if (process.env.NODE_ENV === 'production') {
        return req.url === '/health' || req.url.startsWith('/static/');
      }
      return false;
    }
  });
}

// Create audit logging middleware
export function auditLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Log request start
    const requestLog: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
      branchId: (req as any).user?.branchId,
      startedAt: new Date().toISOString(),
    };

    // Log request completion
    const originalSend = res.send.bind(res);
    res.send = function (this: Response, data: any) {
      const responseTime = Date.now() - start;

      const responseLog = {
        ...requestLog,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        endedAt: new Date().toISOString(),
      };

      // Log to audit system (console for now)
      if (process.env.AUDIT_LOG_ENABLED === 'true') {
        console.log(`[AUDIT] ${JSON.stringify(responseLog, null, 2)}`);
      }

      return originalSend(data);
    } as typeof res.send;

    next();
  };
}

// Create health check logging
export function healthCheckLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Log health check
    const healthLog: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      responseTime: '',
      endedAt: '',
    };

    const originalSend = res.send.bind(res);
    res.send = function (this: Response, data: any) {
      const responseTime = Date.now() - start;

      healthLog.responseTime = `${responseTime}ms`;
      healthLog.endedAt = new Date().toISOString();

      // Log to audit system (console for now)
      if (process.env.AUDIT_LOG_ENABLED === 'true') {
        console.log(`[HEALTH] ${JSON.stringify(healthLog, null, 2)}`);
      }

      return originalSend(data);
    } as typeof res.send;

    next();
  };
}