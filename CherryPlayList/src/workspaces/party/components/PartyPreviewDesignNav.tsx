import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import React from 'react';

export interface PartyPreviewDesignNavProps {
  open: boolean;
  displayOpen?: boolean;
  onToggle: () => void;
  onDisplayToggle?: () => void;
}

export const PartyPreviewDesignNav: React.FC<PartyPreviewDesignNavProps> = ({
  open,
  displayOpen = false,
  onToggle,
  onDisplayToggle = () => undefined,
}) => {
  return (
    <nav className="party-preview-design-nav" aria-label="Настройки превью">
      <button
        type="button"
        className="party-preview-design-nav__toggle"
        aria-expanded={open}
        aria-controls="party-preview-design-panel"
        aria-label={open ? 'Свернуть панель дизайна' : 'Открыть дизайн'}
        title={open ? 'Свернуть панель дизайна' : 'Дизайн'}
        onClick={onToggle}
      >
        <PaletteOutlinedIcon fontSize="inherit" aria-hidden />
      </button>
      <button
        type="button"
        className="party-preview-design-nav__toggle"
        aria-expanded={displayOpen}
        aria-controls="party-preview-display-panel"
        aria-label={displayOpen ? 'Свернуть панель отображения' : 'Открыть отображение'}
        title={displayOpen ? 'Свернуть отображение' : 'Отображение'}
        onClick={onDisplayToggle}
      >
        <TuneOutlinedIcon fontSize="inherit" aria-hidden />
      </button>
    </nav>
  );
};
