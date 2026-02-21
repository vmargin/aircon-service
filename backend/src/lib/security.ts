// Security middleware for XSS protection
import xss from 'xss';

export function sanitizeInput(req: any, res: any, next: any) {
  // Sanitize query parameters
  if (req.query) {
    req.query = Object.keys(req.query).reduce((acc, key) => {
      acc[key] = typeof req.query[key] === 'string' ? xss(req.query[key]) : req.query[key];
      return acc;
    }, {});
  }

  // Sanitize body parameters (for POST/PUT)
  if (req.body) {
    req.body = Object.keys(req.body).reduce((acc, key) => {
      acc[key] = typeof req.body[key] === 'string' ? xss(req.body[key]) : req.body[key];
      return acc;
    }, {});
  }

  // Sanitize params (route parameters)
  if (req.params) {
    req.params = Object.keys(req.params).reduce((acc, key) => {
      acc[key] = typeof req.params[key] === 'string' ? xss(req.params[key]) : req.params[key];
      return acc;
    }, {});
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