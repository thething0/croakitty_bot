import { FlatCompat } from '@eslint/eslintrc';

import { defineConfig } from 'eslint/config';

import tsParser from '@typescript-eslint/parser';
import typescriptEslint from '@typescript-eslint/eslint-plugin';

import importHelpers from 'eslint-plugin-import-helpers';

import prettier from 'eslint-plugin-prettier';

import js from '@eslint/js';

const compat = new FlatCompat({
  baseDirectory: process.cwd(),
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {},
    },
    files: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.tsx'],

    extends: compat.extends('plugin:@typescript-eslint/recommended'),

    plugins: {
      '@typescript-eslint': typescriptEslint,
      'import-helpers': importHelpers,
      prettier,
    },

    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          fixStyle: 'inline-type-imports',
        },
      ],

      quotes: [
        2,
        'single',
        {
          avoidEscape: true,
        },
      ],

      'import-helpers/order-imports': [
        'error',
        {
          newlinesBetween: 'always',

          groups: ['absolute', 'module', '/config/', '/server/', '/bot/', '/utils/', 'parent', 'sibling'],

          alphabetize: {
            order: 'asc',
            ignoreCase: true,
          },
        },
      ],

      'import/extensions': ['off'],
      'import/no-extraneous-dependencies': ['off'],
      'import/no-unresolved': ['off'],
      'import/prefer-default-export': ['off'],
    },
  },
]);
