/**
 * Input validation helpers.
 *
 * NOTE: the previous `sanitizeInput` middleware (which ran every request body,
 * query and param through an HTML escaper) has been removed deliberately:
 *
 *  - It only walked top-level keys, so nested objects were never covered.
 *  - It mutated `req.query`, which is a getter in Express 5 and throws there.
 *  - It corrupted legitimate data — a customer called "Smith & Sons" was
 *    persisted as "Smith &amp; Sons".
 *  - Escaping belongs at the point of rendering, not ingestion. React escapes
 *    by default and the API never renders HTML, so there was nothing to defend.
 *
 * XSS protection now comes from `helmet`'s CSP plus React's own escaping, and
 * injection protection comes from Prisma's parameterised queries.
 */

/** RFC-5322-lite: good enough to reject typos, not a substitute for verification. */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Digits only, 8–15 characters (E.164 without the punctuation). */
export function validatePhone(phone: string): boolean {
  return /^[0-9]{8,15}$/.test(phone);
}
