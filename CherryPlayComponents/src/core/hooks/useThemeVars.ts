/**
 * Хук для преобразования customizationSettings в CSS переменные
 */
import React, { useMemo } from 'react';

export function useThemeVars(
  customizationSettings?: Record<string, any>
): React.CSSProperties {
  return useMemo(() => {
    const vars: Record<string, string> = {};

    if (!customizationSettings) {
      return vars as React.CSSProperties;
    }

    for (const [key, value] of Object.entries(customizationSettings)) {
      if (value !== undefined && value !== null) {
        // Преобразуем значения для разных типов настроек
        if (key === 'glowIntensity') {
          // glowIntensity: 0-100 -> 0-1 для rgba
          const intensity =
            typeof value === 'number' ? value / 100 : parseFloat(String(value)) / 100;
          vars[`--${key}`] = String(Math.max(0, Math.min(1, intensity)));
        } else if (key === 'backgroundOpacity') {
          // backgroundOpacity: 0-100 -> 0-1 для rgba
          const opacity =
            typeof value === 'number' ? value / 100 : parseFloat(String(value)) / 100;
          vars[`--${key}`] = String(Math.max(0, Math.min(1, opacity)));
        } else {
          // Для цветов и других значений просто преобразуем в строку
          vars[`--${key}`] = String(value);
        }
      }
    }

    return vars as React.CSSProperties;
  }, [customizationSettings]);
}


