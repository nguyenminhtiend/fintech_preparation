import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export const baseConfig = defineConfig({
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
    reporters: ['tree'],
    exclude: ['node_modules', 'dist'],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
