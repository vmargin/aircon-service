const { spawnSync } = require('node:child_process');

if (process.env.VERCEL !== '1') {
    console.log('Skipping production migrations outside Vercel.');
    process.exit(0);
}

if (!process.env.VERCEL_ENV) {
    console.error('VERCEL_ENV is missing; refusing to deploy without confirming the target environment.');
    process.exit(1);
}

if (process.env.VERCEL_ENV !== 'production') {
    console.log(`Skipping database migrations for the ${process.env.VERCEL_ENV} deployment.`);
    process.exit(0);
}

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing from the production build environment; refusing to deploy without applying migrations.');
    process.exit(1);
}

console.log('Applying additive Prisma migrations to the production database.');
const result = spawnSync('npm', ['run', 'db:deploy', '--prefix', 'backend'], { stdio: 'inherit' });

if (result.error) {
    console.error('Could not start Prisma migration deployment.');
    console.error(result.error.message);
    process.exit(1);
}

process.exit(result.status ?? 1);
