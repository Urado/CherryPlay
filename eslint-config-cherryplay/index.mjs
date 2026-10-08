import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Downgrade preset `error` severities to `warn` for gradual adoption. */
export function softenPreset(rules = {}) {
  return Object.fromEntries(
    Object.entries(rules).map(([key, value]) => {
      if (value === 'error') return [key, 'warn'];
      if (Array.isArray(value) && value[0] === 'error') {
        return [key, ['warn', ...value.slice(1)]];
      }
      return [key, value];
    }),
  );
}

/** @deprecated use softenPreset */
function softenToWarn(rules) {
  return softenPreset(rules);
}

/** Shared CherryPlay React/TS style rules (barrel ban, arrow FC, import graph). */
export const cherryPlayStyleRules = {
  'func-style': ['warn', 'expression'],
  'prefer-arrow-callback': 'warn',
  'react/function-component-definition': [
    'warn',
    {
      namedComponents: 'arrow-function',
      unnamedComponents: 'arrow-function',
    },
  ],
  'import/no-duplicates': 'warn',
  'import/no-useless-path-segments': ['warn', { noUselessIndex: true }],
  'import/no-cycle': ['warn', { maxDepth: 10 }],
  'import/no-mutable-exports': 'warn',
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
  'no-restricted-imports': [
    'warn',
    {
      patterns: [
        {
          regex: '^(\\.\\./)*(components|hooks|utils|services|stores|contexts)$',
          message:
            'Import a concrete module (e.g. ./components/Foo), not a folder barrel. Package public API (@cherryplay/components) is OK.',
        },
      ],
    },
  ],
  'unicorn/filename-case': [
    'warn',
    {
      cases: {
        camelCase: true,
        pascalCase: true,
      },
      ignore: ['\\.d\\.ts$'],
    },
  ],
  'react/jsx-no-useless-fragment': 'warn',
  'react/self-closing-comp': 'warn',
  'react/jsx-curly-brace-presence': ['warn', { props: 'never', children: 'never' }],
};

/**
 * Unified ESLint flat config for CherryPlay React/TS packages.
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir Absolute package root (`import.meta.dirname`)
 * @param {string[]} [options.extraIgnores]
 * @param {object} [options.features]
 * @param {boolean} [options.features.jsxA11y=true]
 * @param {boolean} [options.features.includeNodeGlobals=false] Add Node globals to TS/TSX (Electron)
 * @param {import('eslint').Linter.Config[]} [options.extraConfigs] Package-specific overlays (List: electron/security/jest)
 */
export function createCherryPlayEslintConfig(options) {
  const {
    tsconfigRootDir,
    extraIgnores = [],
    features = {},
    extraConfigs = [],
  } = options;

  const {
    jsxA11y: enableA11y = true,
    includeNodeGlobals = false,
  } = features;

  return tseslint.config(
    {
      ignores: [
        '**/dist/**',
        '**/dist-electron/**',
        '**/coverage/**',
        '**/node_modules/**',
        '**/release/**',
        ...extraIgnores,
      ],
    },
    {
      files: ['**/*.{ts,tsx}'],
      extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
          ecmaFeatures: { jsx: true },
        },
        globals: {
          ...globals.browser,
          ...(includeNodeGlobals ? globals.node : {}),
        },
      },
      plugins: {
        react,
        'react-hooks': reactHooks,
        import: importPlugin,
        unicorn,
        ...(enableA11y ? { 'jsx-a11y': jsxA11y } : {}),
      },
      settings: {
        react: { version: 'detect' },
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            project: tsconfigRootDir,
          },
        },
      },
      rules: {
        ...(react.configs.flat.recommended?.rules ?? {}),
        ...(react.configs.flat['jsx-runtime']?.rules ?? {}),
        // Classic hooks only — flat.recommended in v7 also enables React Compiler rules
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        ...(enableA11y
          ? softenToWarn(jsxA11y.flatConfigs?.recommended?.rules ?? {})
          : {}),
        ...cherryPlayStyleRules,
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/no-explicit-any': 'warn',
        // Soften first-wave type-aware noise while configs stay on recommendedTypeChecked
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
        '@typescript-eslint/require-await': 'warn',
        '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
        '@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/no-misused-promises': 'warn',
        '@typescript-eslint/no-base-to-string': 'warn',
        '@typescript-eslint/only-throw-error': 'warn',
        '@typescript-eslint/unbound-method': 'warn',
        '@typescript-eslint/no-redundant-type-constituents': 'warn',
        '@typescript-eslint/restrict-template-expressions': 'warn',
        'import/no-unresolved': 'off',
        'react/prop-types': 'off',
        'react/display-name': 'warn',
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
      rules: {
        'no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
          },
        ],
      },
    },
    {
      files: [
        '**/*.{config,setup}.{ts,mts,cts,js,mjs,cjs}',
        '**/vite.config.*',
        '**/vitest.config.*',
        '**/jest.config.*',
        '**/eslint.config.*',
        'scripts/**/*.{ts,mts,js,mjs,cjs}',
      ],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'no-empty': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
      },
    },
    ...extraConfigs,
    // Prettier last: turn off formatting rules that conflict (Prettier runs separately)
    eslintConfigPrettier,
  );
}
