module.exports = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'dist-electron/**', 'node_modules/**', 'coverage/**'],
  rules: {
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'color-hex-length': null,
    'alpha-value-notation': null,
    'font-family-name-quotes': null,
  },
};
