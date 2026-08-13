import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import React from 'react';

export interface PartyPreviewDesignNavProps {
  open: boolean;
  onToggle: () => void;
}

export const PartyPreviewDesignNav: React.FC<PartyPreviewDesignNavProps> = ({ open, onToggle }) => {
  return (
    <nav className="party-preview-design-nav" aria-label="Дизайн превью">
      <button
        type="button"
        className="party-preview-design-nav__toggle"
        aria-expanded={open}
        aria-label={open ? 'Свернуть панель дизайна' : 'Открыть дизайн'}
        title={open ? 'Свернуть панель дизайна' : 'Дизайн'}
        onClick={onToggle}
      >
        <PaletteOutlinedIcon fontSize="inherit" aria-hidden />
        <span className="party-preview-design-nav__label">Дизайн</span>
      </button>
    </nav>
  );
};
