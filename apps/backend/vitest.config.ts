import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: ['./tests/setup/vitest.setup.ts'],
      include: ['tests/unit/**/*.spec.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        include: ['src/**/*.ts'],
        exclude: [
          'node_modules/',
          'dist/',
          'tests/**',
          'src/**/*.d.ts',
          'src/types/**',
          '**/types/',
          '**/interfaces/',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
      },
    },
  }),
);
