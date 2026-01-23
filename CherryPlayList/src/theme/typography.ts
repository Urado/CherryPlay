/**
 * Typography configuration
 */

export interface Typography {
  heading: {
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
  };
  body: {
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
  };
  secondary: {
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
  };
  small: {
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
  };
}

export const typography: Typography = {
  heading: {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  body: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  secondary: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.4,
  },
  small: {
    fontSize: '11px',
    fontWeight: 400,
    lineHeight: 1.4,
  },
};
