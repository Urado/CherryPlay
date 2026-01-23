/**
 * Spacing system
 * Base unit: 4px
 */

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export type Spacing = keyof typeof spacing;
