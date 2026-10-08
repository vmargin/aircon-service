/**
 * A Vercel function owns its own Prisma client. Keep each instance to one
 * PostgreSQL session so scaling function instances cannot multiply Prisma's
 * default per-process pool against the shared 15-session production pool.
 */
export function databaseUrlForRuntime(
  databaseUrl: string | undefined,
  isServerless: boolean,
): string | undefined {
  if (!databaseUrl || !isServerless) return databaseUrl;

  try {
    const url = new URL(databaseUrl);
    url.searchParams.set('connection_limit', '1');
    return url.toString();
  } catch {
    // Leave malformed configuration for the existing runtime validation to report.
    return databaseUrl;
  }
}
