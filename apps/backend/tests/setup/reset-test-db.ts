#!/usr/bin/env tsx
/**
 * Reset the test database (drop all data and re-run migrations)
 * Usage: npm run test:db:reset
 */

import { config } from 'dotenv';
import { execSync } from 'child_process';
import { resolve } from 'path';

// Load test environment variables
config({ path: resolve(process.cwd(), '.env.test') });

async function resetTestDatabase() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set in .env.test');
    process.exit(1);
  }

  // Create test database URL by appending _test suffix
  const testDatabaseUrl = baseUrl.replace(/\/([^/]+)(\?|$)/, '/$1_test$2');

  console.log('⚠️  WARNING: This will delete all data in the test database!');
  console.log('Resetting test database...\n');

  try {
    execSync('npx prisma migrate reset --force --skip-seed', {
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
      },
      stdio: 'inherit',
    });

    console.log('\n✓ Test database reset successfully');
  } catch (error: any) {
    console.error('\nERROR: Failed to reset test database');
    process.exit(1);
  }
}

resetTestDatabase();
