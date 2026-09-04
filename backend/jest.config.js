module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    // No setupFilesAfterEnv: the old setup file truncated and re-seeded a live
    // Postgres database before every run, so `npm test` failed on any machine
    // without one. These tests exercise pure logic instead.
    clearMocks: true,
};
