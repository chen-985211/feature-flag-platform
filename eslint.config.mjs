import js from '@eslint/js';
import globals from 'globals';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default ts.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '.tools/**',
      '.build/**',
      'backend/internal/platform/web/assets/**',
      'coverage/**',
      'test-results/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx'],
    extends: [js.configs.recommended, ...ts.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: [
      'frontend/src/**/domain/**/*.{ts,tsx}',
      'frontend/src/**/application/**/*.{ts,tsx}',
      'frontend/src/**/presentation/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Network access belongs to infrastructure.' },
        'XMLHttpRequest',
        'WebSocket',
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'fetch',
          message: 'Network access belongs to infrastructure.',
        },
        {
          object: 'globalThis',
          property: 'fetch',
          message: 'Network access belongs to infrastructure.',
        },
      ],
    },
  },
);
