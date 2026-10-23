module.exports = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'node_modules/**', 'coverage/**'],
  rules: {
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'color-hex-length': null,
    'alpha-value-notation': null,
    'font-family-name-quotes': null,
    'media-feature-range-notation': null,
    'property-no-vendor-prefix': null,
  },
};
