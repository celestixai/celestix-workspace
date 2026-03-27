/**
 * Jest Global Setup
 * Runs ONCE before all test suites. Sets up test database.
 */

import { execSync } from 'child_process';

export default async function globalSetup() {
  console.log('\n🔧 Setting up test environment...');

  // Ensure test database is fresh
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://celestix_test:testpassword@localhost:5432/celestix_test',
      },
    });
    console.log('  ✓ Database migrations applied');
  } catch (err) {
    console.warn('  ⚠ Could not run migrations:', (err as Error).message);
    console.warn('  Make sure PostgreSQL is running and DATABASE_URL is set');
  }

  // Seed minimal test data
  try {
    execSync('npx prisma db seed', {
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://celestix_test:testpassword@localhost:5432/celestix_test',
      },
    });
    console.log('  ✓ Test data seeded');
  } catch {
    console.warn('  ⚠ No seed script configured (add "prisma.seed" to package.json)');
  }

  console.log('  ✓ Test environment ready\n');
}
