import { spacing } from './spacing';
import { theme } from './theme';
import { typography } from './typography';

export const generateCSSVariables = (): string => {
  return `:root {
  --bg-primary: ${theme.background.primary};
  --bg-secondary: ${theme.background.secondary};
  --bg-tertiary: ${theme.background.tertiary};
  --bg-hover: ${theme.background.hover};

  --text-primary: ${theme.text.primary};
  --text-secondary: ${theme.text.secondary};
  --text-disabled: ${theme.text.disabled};

  --accent-primary: ${theme.accent.primary};
  --accent-secondary: ${theme.accent.secondary};

  --state-success: ${theme.state.success};
  --state-error: ${theme.state.error};
  --state-warning: ${theme.state.warning};
  --state-info: ${theme.state.info};
  --selected-bg: ${theme.state.selected.background};
  --selected-border: ${theme.state.selected.border};

  --ui-border: ${theme.ui.border};
  --ui-shadow: ${theme.ui.shadow};

  --spacing-xs: ${spacing.xs};
  --spacing-sm: ${spacing.sm};
  --spacing-md: ${spacing.md};
  --spacing-lg: ${spacing.lg};
  --spacing-xl: ${spacing.xl};
  --spacing-xxl: ${spacing.xxl};

  --font-size-heading: ${typography.heading.fontSize};
  --font-size-body: ${typography.body.fontSize};
  --font-size-secondary: ${typography.secondary.fontSize};
  --font-size-small: ${typography.small.fontSize};
  --font-weight-heading: ${typography.heading.fontWeight};
  --font-weight-body: ${typography.body.fontWeight};
  --line-height-heading: ${typography.heading.lineHeight};
  --line-height-body: ${typography.body.lineHeight};
  --line-height-secondary: ${typography.secondary.lineHeight};
}`;
};
