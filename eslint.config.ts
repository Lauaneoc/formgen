import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/dist/**',
      'dist-web/**',
      'dist-server/**',
      'storybook-static/**',
      '**/node_modules/**',
      '**/*.timestamp-*.mjs',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        AbortSignal: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Request: 'readonly',
        RequestInit: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        structuredClone: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: [
      'web/**/*.{ts,tsx}',
      'tests/generated-a11y/**/*.{ts,tsx}',
      'examples/react-consumer/src/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: {
        Blob: 'readonly',
        document: 'readonly',
        FormData: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        requestAnimationFrame: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        window: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
];
