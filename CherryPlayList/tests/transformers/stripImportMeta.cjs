const { createTransformer } = require('ts-jest').default;

const tsTransformer = createTransformer();

module.exports = {
  ...tsTransformer,
  process(sourceText, sourcePath, options) {
    const stripped = sourceText.replaceAll(
      /\bimport\.meta(?:\.env|\.url|\.hot|\.glob)?\b/g,
      (match) => {
        if (match === 'import.meta.env') {
          return '({ MODE: "test", DEV: false, PROD: true, SSR: false })';
        }
        if (match === 'import.meta.url') {
          return JSON.stringify('file:///jest-mock');
        }
        if (match === 'import.meta.hot') {
          return 'undefined';
        }
        if (match === 'import.meta.glob') {
          return '(() => ({}))';
        }
        return '({})';
      },
    );
    return tsTransformer.process(stripped, sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    return tsTransformer.getCacheKey(`strip-import-meta:${sourceText}`, sourcePath, options);
  },
};
