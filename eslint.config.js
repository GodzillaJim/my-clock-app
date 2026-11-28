import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'dist-electron', 'release', 'coverage', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Renderer (React)
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },

  // Main process, preload, tests and tooling
  {
    files: [
      'electron/**/*.ts',
      'test/**/*.ts',
      '*.config.{js,ts}',
      'vitest.workspace.ts',
      '.vscode/**/*.mjs',
      'scripts/**/*.mjs',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  // Colours come from the design tokens (src/theme/tokens.ts), never literals in components
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/tokens.ts', '**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/(#[0-9a-fA-F]{3,8}\\b|rgba?\\()/]',
          message:
            'Use a design token (theme.tokens / palette / var(--fs-…)) instead of a colour literal.',
        },
        {
          selector: 'TemplateElement[value.raw=/(#[0-9a-fA-F]{3,8}\\b|rgba?\\()/]',
          message:
            'Use a design token (theme.tokens / palette / var(--fs-…)) instead of a colour literal.',
        },
      ],
    },
  },
  // App code logs through the leveled loggers (src/services/logger.ts,
  // electron/main/logger.ts), which persist to the log file
  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
    ignores: ['**/__tests__/**'],
    rules: { 'no-console': 'error' },
  },
);
