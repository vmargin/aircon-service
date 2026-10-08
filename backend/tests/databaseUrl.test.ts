import { databaseUrlForRuntime } from '../src/db/databaseUrl';

describe('serverless database connection limits', () => {
  it('caps each serverless Prisma pool at one connection and preserves existing URL options', () => {
    const configured = databaseUrlForRuntime(
      'postgresql://worker:local-test@db.example.test/arctic?sslmode=require&connection_limit=8',
      true,
    );

    const parsed = new URL(configured!);
    expect(parsed.searchParams.get('connection_limit')).toBe('1');
    expect(parsed.searchParams.get('sslmode')).toBe('require');
    expect(parsed.pathname).toBe('/arctic');
  });

  it('leaves non-serverless and missing database URLs unchanged', () => {
    const localUrl = 'postgresql://worker:local-test@127.0.0.1:5433/arctic_dev';
    expect(databaseUrlForRuntime(localUrl, false)).toBe(localUrl);
    expect(databaseUrlForRuntime(undefined, true)).toBeUndefined();
  });
});
