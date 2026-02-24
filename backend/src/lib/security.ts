// Security middleware for XSS protection
import xss from 'xss';
import { Request, Response, NextFunction } from 'express';

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  // Sanitize query parameters
  if (req.query) {
    const sanitizedQuery: Record<string, any> = {};
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      sanitizedQuery[key] = typeof val === 'string' ? xss(val) : val;
    }
    req.query = sanitizedQuery;
  }

  // Sanitize body parameters (for POST/PUT)
  if (req.body && typeof req.body === 'object') {
    const sanitizedBody: Record<string, any> = {};
    for (const key of Object.keys(req.body)) {
      const val = req.body[key];
      sanitizedBody[key] = typeof val === 'string' ? xss(val) : val;
    }
    req.body = sanitizedBody;
  }

  // Sanitize params (route parameters)
  if (req.params) {
    const sanitizedParams: Record<string, string> = {};
    for (const key of Object.keys(req.params)) {
      sanitizedParams[key] = typeof req.params[key] === 'string' ? xss(req.params[key]) : req.params[key];
    }
    req.params = sanitizedParams;
  }

  next();
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Simple phone validation - digits only, 8-15 characters
  const phoneRegex = /^[0-9]{8,15}$/;
  return phoneRegex.test(phone);
}

export function sanitizeString(input: string): string {
  return xss(input);
}