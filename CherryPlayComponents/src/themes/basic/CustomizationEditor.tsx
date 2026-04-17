import React, { useState } from 'react';

import {
  getBasicThemePaletteCatalog,
  normalizeBasicThemePaletteSettings,
  type BasicThemePaletteCatalogItem,
} from '../base/colors';
import type { ThemeCustomizationEditorProps } from '../index';

type HexDraftState = Record<string, string>;

const BASIC_CUSTOM_COLOR_FIELDS = [
  { key: 'customAccentPrimary', paletteKey: 'accentPrimary', label: 'Акцент' },
  { key: 'customTextPrimary', paletteKey: 'textPrimary', label: 'Основной текст' },
  { key: 'customBackgroundPrimary', paletteKey: 'backgroundPrimary', label: 'Фон страницы' },
  { key: 'customTrackAreaBackground', paletteKey: 'trackAreaBackground', label: 'Фон списка' },
  { key: 'customTrackBackground', paletteKey: 'trackBackground', label: 'Фон трека' },
] as const;

type BasicCustomField = (typeof BASIC_CUSTOM_COLOR_FIELDS)[number];

function normalizeHexInput(value: string): string | null {
  const trimmed = value.trim();
  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

  if (/^[\da-fA-F]{6}$/.test(withoutHash)) {
    return `#${withoutHash.toLowerCase()}`;
  }

  if (/^[\da-fA-F]{3}$/.test(withoutHash)) {
    const expanded = withoutHash
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
    return `#${expanded.toLowerCase()}`;
  }

  return null;
}

function getBasicPalettePreviewStyle(
  paletteItem: BasicThemePaletteCatalogItem,
): React.CSSProperties {
  return {
    ['--palette-preview-accent' as string]: paletteItem.palette.accentPrimary,
    ['--palette-preview-text' as string]: paletteItem.palette.textPrimary,
    ['--palette-preview-bg-primary' as string]: paletteItem.palette.backgroundPrimary,
    ['--palette-preview-bg-secondary' as string]: paletteItem.palette.trackAreaBackground,
    ['--palette-preview-bg-tertiary' as string]: paletteItem.palette.trackBackground,
  };
}

export const BasicThemeCustomizationEditor: React.FC<ThemeCustomizationEditorProps> = ({
  customizationSettings,
  onCustomizationSettingsChange,
}) => {
  const [hexDrafts, setHexDrafts] = useState<HexDraftState>({});

  const basicPaletteSettings = normalizeBasicThemePaletteSettings(customizationSettings);
  const basicPaletteCatalog = getBasicThemePaletteCatalog(customizationSettings);

  const handleBasicCustomColorChange = (field: BasicCustomField, nextHex: string) => {
    onCustomizationSettingsChange({
      ...customizationSettings,
      paletteId: 'custom',
      customPalette: {
        ...basicPaletteSettings.customPalette,
        [field.paletteKey]: nextHex,
      },
    });
  };

  const handleBasicPaletteSelect = (paletteId: string) => {
    setHexDrafts({});

    if (paletteId === 'custom') {
      onCustomizationSettingsChange({
        ...customizationSettings,
        paletteId,
      });
      return;
    }

    const selectedPalette = basicPaletteCatalog.find(
      (paletteItem) => paletteItem.id === paletteId && !paletteItem.isCustom,
    )?.palette;

    if (!selectedPalette) {
      onCustomizationSettingsChange({
        ...customizationSettings,
        paletteId,
      });
      return;
    }

    onCustomizationSettingsChange({
      ...customizationSettings,
      paletteId,
      customPalette: {
        accentPrimary: selectedPalette.accentPrimary,
        textPrimary: selectedPalette.textPrimary,
        backgroundPrimary: selectedPalette.backgroundPrimary,
        trackAreaBackground: selectedPalette.trackAreaBackground,
        trackBackground: selectedPalette.trackBackground,
      },
    });
  };

  return (
    <div className="party-editor-section">
      <div className="party-editor-label">Палитра базовой темы</div>
      <div className="party-editor-basic-palette-grid">
        {basicPaletteCatalog.map((paletteItem) => {
          const isSelected = basicPaletteSettings.paletteId === paletteItem.id;
          return (
            <button
              key={paletteItem.id}
              type="button"
              className={`party-editor-palette-option ${isSelected ? 'party-editor-palette-option--selected' : ''}`}
              onClick={() => handleBasicPaletteSelect(paletteItem.id)}
              aria-pressed={isSelected}
            >
              <div
                className="party-editor-palette-preview"
                style={getBasicPalettePreviewStyle(paletteItem)}
                aria-hidden="true"
              >
                <span className="party-editor-palette-swatch party-editor-palette-swatch--bg-primary" />
                <span className="party-editor-palette-swatch party-editor-palette-swatch--bg-secondary" />
                <span className="party-editor-palette-swatch party-editor-palette-swatch--bg-tertiary" />
                <span className="party-editor-palette-swatch party-editor-palette-swatch--accent" />
                <span className="party-editor-palette-swatch party-editor-palette-swatch--text" />
              </div>
              <span className="party-editor-palette-option-label">{paletteItem.label}</span>
            </button>
          );
        })}
      </div>

      {basicPaletteSettings.paletteId === 'custom' && (
        <div className="party-editor-custom-colors">
          {BASIC_CUSTOM_COLOR_FIELDS.map((field) => {
            const resolvedHex = basicPaletteSettings.customPalette[field.paletteKey];
            const draftHex = hexDrafts[field.key] ?? resolvedHex;
            return (
              <div key={field.key} className="party-editor-custom-color-row">
                <label
                  className="party-editor-custom-color-label"
                  htmlFor={`basic-color-${field.key}`}
                >
                  {field.label}
                </label>
                <div className="party-editor-custom-color-controls">
                  <input
                    id={`basic-color-${field.key}`}
                    type="color"
                    value={resolvedHex}
                    onChange={(e) => {
                      const normalized =
                        normalizeHexInput(e.target.value) ??
                        basicPaletteSettings.customPalette[field.paletteKey];
                      setHexDrafts((prev) => ({ ...prev, [field.key]: normalized }));
                      handleBasicCustomColorChange(field, normalized);
                    }}
                    className="party-editor-custom-color-picker"
                    aria-label={`${field.label} - выбор цвета`}
                  />
                  <input
                    type="text"
                    value={draftHex}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHexDrafts((prev) => ({ ...prev, [field.key]: value }));
                      const normalized = normalizeHexInput(value);
                      if (normalized) {
                        handleBasicCustomColorChange(field, normalized);
                      }
                    }}
                    onBlur={() => {
                      const normalized = normalizeHexInput(hexDrafts[field.key] ?? '');
                      const fallback = basicPaletteSettings.customPalette[field.paletteKey];
                      const nextValue = normalized ?? fallback;
                      setHexDrafts((prev) => ({ ...prev, [field.key]: nextValue }));
                      handleBasicCustomColorChange(field, nextValue);
                    }}
                    placeholder="#ffffff"
                    className="party-editor-input party-editor-custom-color-hex-input"
                    aria-label={`${field.label} - HEX`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
