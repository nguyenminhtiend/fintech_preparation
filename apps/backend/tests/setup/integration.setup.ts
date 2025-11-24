import { config } from 'dotenv';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { TestDatabase } from '../helpers/test-database';

// Load environment variables from .env.test file
config({ path: '.env.test' });

/**
 * Setup before all tests
 * Prerequisites (manual or CI/CD):
 * 1. Test database must be created (e.g., createdb fintech_app_test)
 * 2. Migrations must be applied: DATABASE_URL="..." npm run db:migrate:deploy
 *
 * For schema changes:
 * - Apply migrations manually to the test database using standard Prisma commands
 */
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  // Connect to existing test database
  await TestDatabase.setup();
}, 10000); // 10 second timeout for connection

// Clean database after each test for isolation
afterEach(async () => {
  await TestDatabase.cleanDatabase();
}, 10000);

// Cleanup after all tests
afterAll(async () => {
  await TestDatabase.teardown();
}, 10000);
