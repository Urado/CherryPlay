import { getPartyTheme, partyThemes, type PartyThemeId } from '@cherryplay/components';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import './PartyEditor.css';

export interface PartyDesignLockedThemeInfo {
  themeId: PartyThemeId;
  packageCode: string;
  packageName: string;
}

interface PartyDesignSettingsBlockProps {
  themeId: PartyThemeId;
  customizationSettings: Record<string, unknown>;
  onThemeIdChange: (themeId: PartyThemeId) => void;
  onCustomizationSettingsChange: (settings: Record<string, unknown>) => void;
  readOnly?: boolean;
  lockedThemes?: PartyDesignLockedThemeInfo[];
  visibleThemeIds?: PartyThemeId[] | null;
  isThemeAccessLoading?: boolean;
  themeAccessErrorMessage?: string | null;
  allowLockedSelection?: boolean;
  showApplyButton?: boolean;
  applyButtonLabel?: string;
  applyButtonClassName?: string;
  hideSectionLabel?: boolean;
}

const PARTY_THEME_PREVIEWS: Record<PartyThemeId, string> = {
  cyberpunk: '💚 Неоновое свечение, темный фон, футуристический стиль',
  sakura: '🌸 Розовые оттенки, мягкие переходы, элегантный дизайн',
  'art-deco': '✨ Золотые акценты, геометрические паттерны, роскошный вид',
  'spring-cross-step': '🌿 Весенние оттенки, мягкие акценты, свежий ритм',
  basic: '📋 Простой дизайн, темный фон, синий акцент',
};

const AVAILABLE_STYLES = partyThemes.map((theme) => ({
  id: theme.id,
  name: theme.name,
  description: theme.description,
  preview: PARTY_THEME_PREVIEWS[theme.id] || theme.description,
}));

export const PartyDesignSettingsBlock: React.FC<PartyDesignSettingsBlockProps> = ({
  themeId,
  customizationSettings,
  onThemeIdChange,
  onCustomizationSettingsChange,
  readOnly = false,
  lockedThemes = [],
  visibleThemeIds = null,
  isThemeAccessLoading = false,
  themeAccessErrorMessage = null,
  allowLockedSelection = false,
  showApplyButton = false,
  applyButtonLabel = 'Изменить дизайн',
  applyButtonClassName = 'party-editor-design-apply-button',
  hideSectionLabel = false,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingThemeId, setPendingThemeId] = useState<PartyThemeId>(themeId);
  const [hasPendingThemeOverride, setHasPendingThemeOverride] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lockedThemeMap = useMemo(
    () =>
      new Map<PartyThemeId, PartyDesignLockedThemeInfo>(
        lockedThemes.map((item) => [item.themeId, item]),
      ),
    [lockedThemes],
  );
  const visibleThemeIdSet = visibleThemeIds ? new Set(visibleThemeIds) : null;

  const stylesForDropdown = AVAILABLE_STYLES.filter((style) => {
    if (!visibleThemeIdSet) {
      return true;
    }
    return (
      visibleThemeIdSet.has(style.id) ||
      style.id === themeId ||
      (showApplyButton && hasPendingThemeOverride && style.id === pendingThemeId)
    );
  });

  const sortedStylesForDropdown = [...stylesForDropdown].sort((a, b) => {
    if (a.id === 'basic' && b.id !== 'basic') {
      return -1;
    }
    if (b.id === 'basic' && a.id !== 'basic') {
      return 1;
    }

    const aLocked = lockedThemeMap.has(a.id);
    const bLocked = lockedThemeMap.has(b.id);
    if (aLocked === bLocked) {
      return 0;
    }
    return aLocked ? 1 : -1;
  });

  const effectiveThemeId = showApplyButton && hasPendingThemeOverride ? pendingThemeId : themeId;
  const selectedStyle =
    AVAILABLE_STYLES.find((s) => s.id === effectiveThemeId) || AVAILABLE_STYLES[0];
  const selectedLockedTheme = lockedThemeMap.get(effectiveThemeId) ?? null;

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      zIndex: 1100,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsDropdownOpen(false);
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isDropdownOpen, updateMenuPosition]);

  const handleStyleSelect = (nextThemeId: PartyThemeId) => {
    const isLocked = lockedThemeMap.has(nextThemeId);
    if (isLocked && !allowLockedSelection) {
      return;
    }

    if (showApplyButton) {
      setPendingThemeId(nextThemeId);
      setHasPendingThemeOverride(true);
    } else {
      onThemeIdChange(nextThemeId);
    }
    setIsDropdownOpen(false);
  };

  const renderCustomizationOptions = () => {
    const theme = getPartyTheme(effectiveThemeId);
    const ThemeCustomizationEditor = theme?.components.CustomizationEditor;

    if (!ThemeCustomizationEditor) {
      return null;
    }

    return (
      <ThemeCustomizationEditor
        customizationSettings={customizationSettings}
        onCustomizationSettingsChange={onCustomizationSettingsChange}
      />
    );
  };

  const dropdownMenu = isDropdownOpen ? (
    <div
      ref={menuRef}
      className="party-editor-dropdown-menu party-editor-dropdown-menu--portal"
      style={menuStyle}
      role="listbox"
      aria-label="Выбор стиля оформления"
    >
      {sortedStylesForDropdown.map((style) => {
        const lockedTheme = lockedThemeMap.get(style.id);
        const isLocked = Boolean(lockedTheme);
        const isSelected = effectiveThemeId === style.id;
        return (
          <button
            key={style.id}
            type="button"
            className={`party-editor-dropdown-item ${isSelected ? 'party-editor-dropdown-item--selected' : ''} ${isLocked ? 'party-editor-dropdown-item--locked' : ''}`}
            onClick={() => handleStyleSelect(style.id)}
            aria-label={
              isLocked ? `${style.name}. Требуется пакет ${lockedTheme?.packageName}.` : style.name
            }
          >
            <div className="party-editor-dropdown-item-content">
              <div className="party-editor-dropdown-item-name">{style.name}</div>
              <div className="party-editor-dropdown-item-description">{style.description}</div>
              <div className="party-editor-dropdown-item-preview">{style.preview}</div>
              {isLocked && lockedTheme && (
                <div className="party-editor-theme-lock-info">
                  Доступно в пакете {lockedTheme.packageName}
                </div>
              )}
            </div>
            {isSelected && <span className="party-editor-dropdown-item-check">✓</span>}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="party-editor-section">
      {!hideSectionLabel && (
        <label htmlFor="theme-selector" className="party-editor-label">
          Стиль оформления
        </label>
      )}
      <div className="party-editor-dropdown" ref={dropdownRef}>
        <button
          id="theme-selector"
          ref={buttonRef}
          type="button"
          className="party-editor-dropdown-button"
          aria-label={hideSectionLabel ? 'Стиль оформления' : undefined}
          onClick={() => {
            setIsDropdownOpen((open) => {
              const next = !open;
              if (next) {
                requestAnimationFrame(updateMenuPosition);
              }
              return next;
            });
          }}
          aria-expanded={isDropdownOpen}
          disabled={readOnly}
        >
          <div className="party-editor-dropdown-button-content">
            <div className="party-editor-dropdown-selected">
              <span className="party-editor-dropdown-name">{selectedStyle.name}</span>
              <span className="party-editor-dropdown-preview">{selectedStyle.preview}</span>
              {selectedLockedTheme && (
                <span className="party-editor-theme-status-badge">Ограничен доступ</span>
              )}
            </div>
            <span className="party-editor-dropdown-arrow">{isDropdownOpen ? '▲' : '▼'}</span>
          </div>
        </button>
        {dropdownMenu && createPortal(dropdownMenu, document.body)}
      </div>
      {showApplyButton && (
        <button
          type="button"
          className={applyButtonClassName}
          onClick={() => {
            setHasPendingThemeOverride(false);
            onThemeIdChange(pendingThemeId);
          }}
        >
          {applyButtonLabel}
        </button>
      )}
      {isThemeAccessLoading && (
        <div className="party-editor-theme-access-hint">Проверяем доступные темы...</div>
      )}
      {themeAccessErrorMessage && (
        <div className="party-editor-theme-access-hint party-editor-theme-access-hint--warning">
          {themeAccessErrorMessage}
        </div>
      )}
      {renderCustomizationOptions()}
    </div>
  );
};
