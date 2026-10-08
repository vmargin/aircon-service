import { PrismaClient } from '@prisma/client';
import { databaseUrlForRuntime } from './databaseUrl';

/**
 * PRISMA CLIENT SINGLETON
 * 
 * Using a singleton pattern ensures we only have ONE database connection 
 * manager. This is standard in professional Node.js projects to avoid 
 * connection pool exhaustion.
 */

const isServerless = process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const datasourceUrl = databaseUrlForRuntime(process.env.DATABASE_URL, isServerless);

const prisma = new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * GRACEFUL SHUTDOWN HANDLER
 */
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export default prisma;
