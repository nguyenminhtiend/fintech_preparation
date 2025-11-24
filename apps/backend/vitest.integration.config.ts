import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@modules': path.resolve(__dirname, './src/modules'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/database.setup.ts'],
    include: ['tests/integration/**/*.spec.ts', 'tests/api/**/*.api.spec.ts'],
    exclude: ['node_modules', 'dist', 'tests/unit/**', 'tests/e2e/**'],
    pool: 'forks',
    maxConcurrency: 1,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
