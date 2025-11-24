import { afterAll, afterEach, beforeAll } from 'vitest';

// Setup before all tests
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
});

// Reset mocks after each test
afterEach(() => {
  // Mocks are automatically reset due to mockReset: true in vitest.config.ts
});

// Cleanup after all tests
afterAll(() => {
  // Any global cleanup can go here
});
