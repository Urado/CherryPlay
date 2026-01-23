/**
 * Фасадный компонент для отображения вечеринки
 * Принимает стандартизированные данные и автоматически выбирает нужную тему
 * Фронт не должен знать о внутренней реализации тем
 */
import React from 'react';

import { PartyDisplayData } from '../../types';
import { getThemeOrDefault, ThemeId } from '../../themes';

export interface PartyDisplayProps {
  /** Единый объект данных для отображения */
  data: PartyDisplayData;
  /** Дополнительные CSS классы */
  className?: string;
  /** Показывать ли компонент CurrentTrackDisplay */
  showPlayer?: boolean;
}

export const PartyDisplay: React.FC<PartyDisplayProps> = ({
  data,
  className = '',
  showPlayer = true,
}) => {
  // Получаем тему по themeId или используем тему по умолчанию
  const theme = getThemeOrDefault(data.themeId as ThemeId);
  
  // Используем компонент PartyDisplay из выбранной темы
  const ThemePartyDisplay = theme.components.PartyDisplay;

  return (
    <ThemePartyDisplay
      data={data}
      className={className}
      showPlayer={showPlayer}
    />
  );
};

