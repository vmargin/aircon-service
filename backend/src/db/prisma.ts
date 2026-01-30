import { PrismaClient } from '@prisma/client';

/**
 * PRISMA CLIENT SINGLETON
 * 
 * Using a singleton pattern ensures we only have ONE database connection 
 * manager. This is standard in professional Node.js projects to avoid 
 * connection pool exhaustion.
 */

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * GRACEFUL SHUTDOWN HANDLER
 */
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export default prisma;
