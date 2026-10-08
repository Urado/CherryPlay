import electron from 'eslint-plugin-electron';
import jestPlugin from 'eslint-plugin-jest';
import jestDom from 'eslint-plugin-jest-dom';
import security from 'eslint-plugin-security';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';

import { createCherryPlayEslintConfig, softenPreset } from '@cherryplay/eslint-config';

const testingLibraryReact = testingLibrary.configs['flat/react'];
const jestDomRecommended = jestDom.configs['flat/recommended'];
const jestRecommended = jestPlugin.configs['flat/recommended'];

const listOverlays = [
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/tests/**/*.{ts,tsx}'],
    plugins: {
      ...testingLibraryReact.plugins,
      ...jestDomRecommended.plugins,
      ...jestRecommended.plugins,
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...softenPreset(testingLibraryReact.rules),
      ...softenPreset(jestDomRecommended.rules),
      ...softenPreset(jestRecommended.rules),
    },
  },
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    plugins: { security },
    rules: {
      ...softenPreset(security.configs.recommended?.rules ?? {}),
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['electron/**/*.{ts,tsx,mjs,js}'],
    plugins: { electron },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'electron/no-deprecated-apis': 'error',
      'electron/no-deprecated-arguments': 'error',
      'electron/no-deprecated-props': 'error',
      'electron/default-value-changed': 'warn',
      'import/no-extraneous-dependencies': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
];

export default createCherryPlayEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  features: {
    jsxA11y: true,
    includeNodeGlobals: true,
  },
  extraIgnores: ['husky/**', 'plugins/example-plugin/**'],
  extraConfigs: listOverlays,
});
