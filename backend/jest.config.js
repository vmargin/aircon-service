module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    // Pure tests run without a database. HTTP integration requires the explicit
    // local TEST_DATABASE_URL supplied by `node scripts/local.cjs test`; its
    // fixtures are UUID-owned and it never truncates or reads production .env.
    clearMocks: true,
};
