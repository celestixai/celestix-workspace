// Push Prisma schema with timeout — used on Railway startup
const { execSync } = require('child_process');
try {
  console.log('Pushing Prisma schema to database...');
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    timeout: 30000, // 30 second timeout
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DIRECT_URL || process.env.DATABASE_URL }
  });
  console.log('Schema push complete.');
} catch (e) {
  console.warn('Schema push skipped:', e.message?.substring(0, 100) || 'timeout or error');
}
