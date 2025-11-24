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
    setupFiles: ['./tests/setup/integration.setup.ts'],
    include: ['tests/integration/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'tests/unit/**', 'tests/api/**', 'tests/e2e/**'],
    // Integration tests run with limited concurrency to avoid database conflicts
    pool: 'forks',
    maxConcurrency: 1,
    // Longer timeout for database operations
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
