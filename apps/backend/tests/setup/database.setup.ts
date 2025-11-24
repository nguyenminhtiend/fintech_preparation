import { config } from 'dotenv';

config({ path: '.env.test' });

import { afterAll, afterEach, beforeAll } from 'vitest';

import { TestDatabase } from '../helpers/test-database';

/**
 * Unified Database Test Setup
 * Shared setup for both Integration and API tests
 *
 * This setup:
 * - Loads test environment variables from .env.test
 * - Initializes test database connection
 * - Cleans database after each test for isolation
 * - Closes database connection after all tests
 *
 * Used by:
 * - Integration tests (Service + Repository + Database)
 * - API tests (HTTP + Controller + Service + Repository + Database)
 */

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  await TestDatabase.setup();
}, 10000);

afterEach(async () => {
  await TestDatabase.cleanDatabase();
}, 10000);

afterAll(async () => {
  await TestDatabase.teardown();
}, 10000);
