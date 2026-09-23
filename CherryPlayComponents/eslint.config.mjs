import { createCherryPlayEslintConfig } from '@cherryplay/eslint-config';

export default createCherryPlayEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  features: {
    jsxA11y: true,
  },
});
