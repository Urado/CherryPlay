/**
 * Theme colors configuration
 * Dark theme by default
 */

export interface ThemeColors {
  background: {
    primary: string; // Main background
    secondary: string; // Panels, cards
    tertiary: string; // Items, list elements
    hover: string; // Hover state
  };
  text: {
    primary: string; // Main text
    secondary: string; // Secondary text, hints
    disabled: string; // Disabled text
  };
  accent: {
    primary: string; // Primary accent color
    secondary: string; // Secondary accent
  };
  state: {
    selected: {
      background: string; // Selected item background
      border: string; // Selected item border
    };
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  ui: {
    border: string; // Borders, dividers
    shadow: string; // Shadows
  };
}

export const darkTheme: ThemeColors = {
  background: {
    primary: '#1e1e1e',
    secondary: '#252525',
    tertiary: '#2a2a2a',
    hover: '#323232',
  },
  text: {
    primary: '#ffffff',
    secondary: '#b0b0b0',
    disabled: '#666666',
  },
  accent: {
    primary: '#4a9eff',
    secondary: '#6495ed',
  },
  state: {
    selected: {
      background: '#3a4a5a',
      border: '#6495ed',
    },
    success: '#4caf50',
    error: '#d32f2f',
    warning: '#ff9800',
    info: '#2196f3',
  },
  ui: {
    border: '#3a3a3a',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
};

// Export current theme (for future theme switching)
export const theme = darkTheme;
