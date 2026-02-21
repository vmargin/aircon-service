import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';

// Create custom morgan formats
const customFormats = {
  // Compact format for production
  tiny: ':method :url :status :res[content-length] - :response-time ms',
  
  // Detailed format for development
  dev: ':method :url :status :response-time ms - :res[content-length]',
  
  // JSON format for logging systems
  json: {
    skip: (req: Request, res: Response) => {
      // Skip health checks and static files
      return req.url === '/health' || req.url.startsWith('/static/');
    },
    stream: {
      write: (message: string) => {
        // Parse the JSON log
        const logEntry = JSON.parse(message);
        
        // Add additional context
        logEntry.timestamp = new Date().toISOString();
        logEntry.userAgent = req.headers["user-agent"];
        logEntry.ip = req.ip || req.connection.remoteAddress;
        
        // Log to console (or your logging system)
        console.log(JSON.stringify(logEntry, null, 2));
      }
    }
  }
};

// Create request logging middleware
export function requestLogger() {
  const format = process.env.NODE_ENV === 'production' ? 'tiny' : 'dev';
  
  return morgan(format, {
    skip: (req: Request, res: Response) => {
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
    const requestLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
      userId: req.user?.id, // Assuming you have user in req.user from auth
      branchId: req.user?.branchId,
      startedAt: new Date().toISOString(),
    };
    
    // Log request completion
    const originalSend = res.send;
    res.send = function (data) {
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
      
      return originalSend.apply(res, arguments);
    };
    
    next();
  };
}

// Create health check logging
export function healthCheckLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Log health check
    const healthLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
      userId: req.user?.id,
      branchId: req.user?.branchId,
      responseTime: '',
      endedAt: '',
    };
    
    const originalSend = res.send;
    res.send = function (data) {
      const responseTime = Date.now() - start;
      
      healthLog.responseTime = `${responseTime}ms`;
      healthLog.endedAt = new Date().toISOString();
      
      // Log to audit system (console for now)
      if (process.env.AUDIT_LOG_ENABLED === 'true') {
        console.log(`[HEALTH] ${JSON.stringify(healthLog, null, 2)}`);
      }
      
      return originalSend.apply(res, arguments);
    };
    
    next();
  };
}