import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import security from 'eslint-plugin-security';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const electronRules = {
  'electron/no-deprecated-apis': 'error',
  'electron/no-deprecated-arguments': 'error',
  'electron/no-deprecated-props': 'error',
  'electron/default-value-changed': 'warn',
};

const baseConfig = {
  root: true,
  env: {
    browser: true,
    es2023: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      './tsconfig.json',
      './tsconfig.node.json',
      './tsconfig.electron.json',
      './tsconfig.preload.json',
      './tsconfig.jest.json',
    ],
    tsconfigRootDir: __dirname,
    ecmaVersion: 'latest',
    sourceType: 'module',
    noWarnOnMultipleProjects: true,
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'jsx-a11y',
    'import',
    'testing-library',
    'jest-dom',
    'jest',
    'security',
    'electron',
    'prettier',
  ],
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      typescript: {
        project: [
          './tsconfig.json',
          './tsconfig.node.json',
          './tsconfig.electron.json',
          './tsconfig.preload.json',
          './tsconfig.jest.json',
        ],
      },
    },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:testing-library/react',
    'plugin:jest-dom/recommended',
    'plugin:jest/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'prettier/prettier': 'error',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    'import/no-unresolved': 'off',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    ...(security.configs.recommended?.rules ?? {}),
    ...electronRules,
    'security/detect-object-injection': 'off',
  },
  overrides: [
    {
      files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
      env: {
        jest: true,
      },
      extends: ['plugin:testing-library/react', 'plugin:jest-dom/recommended'],
    },
    {
      files: ['electron/**/*.ts', 'electron/**/*.tsx', 'electron/**/*.mjs'],
      env: {
        node: true,
      },
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'security/detect-non-literal-fs-filename': 'off',
      },
    },
    {
      files: ['*.js', '*.cjs', '*.mjs'],
      env: {
        node: true,
      },
      parserOptions: {
        project: null,
      },
      rules: {
        'import/no-unresolved': 'off',
        'import/namespace': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['*.config.ts', '*.config.mts', '*.config.cts', 'jest.config.ts', 'vite.config.mjs'],
      env: {
        node: true,
      },
      parserOptions: {
        project: null,
      },
      rules: {
        'import/no-unresolved': 'off',
        'import/namespace': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'no-undef': 'off',
      },
    },
  ],
};

export default [
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'coverage/**',
      'node_modules/**',
      'husky/**',
      'plugins/example-plugin/**',
    ],
  },
  ...compat.config(baseConfig),
];
