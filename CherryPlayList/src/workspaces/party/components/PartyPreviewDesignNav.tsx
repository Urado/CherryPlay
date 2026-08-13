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
        aria-label={open ? 'Свернуть панель дизайна' : 'Развернуть панель дизайна'}
        title={open ? 'Свернуть панель дизайна' : 'Развернуть панель дизайна'}
        onClick={onToggle}
      >
        ≡
      </button>
    </nav>
  );
};
