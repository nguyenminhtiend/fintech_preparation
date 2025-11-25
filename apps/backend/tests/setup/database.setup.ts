import { config } from 'dotenv';

config({ path: '.env.test' });

import { afterAll, afterEach, beforeAll } from 'vitest';

import { TestDatabase } from '../helpers/test-database';

beforeAll(async () => {
  await TestDatabase.setup();
}, 10000);

afterEach(async () => {
  await TestDatabase.cleanDatabase();
}, 10000);

afterAll(async () => {
  await TestDatabase.teardown();
}, 10000);
