module.exports = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'dist-electron/**', 'node_modules/**', 'coverage/**'],
  rules: {
    'selector-class-pattern': null,
    'no-missing-end-of-source-newline': null, // Handled by Prettier
    'no-descending-specificity': null, // Allow hover before disabled for better readability
    'color-function-notation': null, // Allow rgba() notation
    'color-function-alias-notation': null, // Allow rgba() notation
    'color-hex-length': null, // Allow full hex colors for consistency
    'alpha-value-notation': null, // Allow decimal alpha values
    'font-family-name-quotes': null, // Allow quotes for font names with spaces
  },
};
