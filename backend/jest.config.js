module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/*.test.ts'],
    setupFilesAfterEnv: ['./tests/integration/setup.ts'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};
