import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: ['./tests/setup/database.setup.ts'],
      include: ['tests/integration/**/*.spec.ts', 'tests/api/**/*.api.spec.ts'],
      pool: 'forks',
      maxConcurrency: 1,
      fileParallelism: false,
      testTimeout: 30000,
      hookTimeout: 30000,
      teardownTimeout: 10000,
    },
  }),
);
