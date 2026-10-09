// @ts-check
import eslint from '@eslint/js';
import eslintTs from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default eslintTs.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'api/', '**/*.d.ts'],
  },
  {
    extends: [
      eslint.configs.recommended,
      ...eslintTs.configs.recommended,
      eslintConfigPrettier,
    ],
    files: ['**/*.ts'],
    rules: {
      // El codigo actual usa `any` en algunos parsers/DTOs; se controla en revisiones.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
