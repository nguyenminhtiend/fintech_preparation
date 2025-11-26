import tseslint from 'typescript-eslint';
import rootConfig from '../../eslint.config.js';

export default tseslint.config(
  ...rootConfig,
  {
    ignores: [
      '*.config.{js,ts}',
      'vite.config.ts',
      'react-router.config.ts',
      '.react-router/**',
    ],
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
);