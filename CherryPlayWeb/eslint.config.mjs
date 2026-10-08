import testingLibrary from 'eslint-plugin-testing-library';

import { createCherryPlayEslintConfig, softenPreset } from '@cherryplay/eslint-config';

const testingLibraryReact = testingLibrary.configs['flat/react'];

export default createCherryPlayEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  features: {
    jsxA11y: true,
  },
  extraIgnores: ['CherryPlayList/**', 'CherryPlayComponents/**', 'eslint-out.json'],
  extraConfigs: [
    {
      files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
      plugins: testingLibraryReact.plugins,
      rules: softenPreset(testingLibraryReact.rules),
    },
  ],
});
