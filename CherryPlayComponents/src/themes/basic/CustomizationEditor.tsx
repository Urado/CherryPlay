import React, { useState } from 'react';

import type { ThemeCustomizationEditorProps } from '../partyThemeTypes';

import {
  areBasicCustomPalettesEqual,
  BASIC_THEME_DARK_GRADIENT_PRESETS,
  BASIC_THEME_DARK_NEON_PRESETS,
  BASIC_THEME_LIGHT_ACCENT_PRESETS,
  BASIC_THEME_LIGHT_GRADIENT_PRESETS,
  buildBasicFamilyCustomPalette,
  buildBasicThemePaletteCatalog,
  DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS,
  getDefaultBasicThemeCustomPalette,
  isBasicThemePaletteId,
  isBasicThemeFamilyPaletteId,
  normalizeBasicThemePaletteSettings,
  normalizeHexColor,
  parseBasicThemeUserSavedCatalogId,
  type BaseThemeFamilyPaletteId,
  type BaseThemeColorPaletteCatalogItem,
  type BaseThemeUserSavedPalette,
} from './palette';

type HexDraftState = Record<string, string>;
let basicUserPaletteIdCounter = 0;

function createBasicUserPaletteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  basicUserPaletteIdCounter += 1;
  return `up-${basicUserPaletteIdCounter}`;
}

function isDefaultBasicThemeSelection(settings: Record<string, unknown>): boolean {
  const current = normalizeBasicThemePaletteSettings(settings);
  const baseline = normalizeBasicThemePaletteSettings(DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS);
  if (current.paletteId !== baseline.paletteId) {
    return false;
  }
  const a = current.customPalette;
  const b = baseline.customPalette;
  return (
    a.accentPrimary === b.accentPrimary &&
    a.textPrimary === b.textPrimary &&
    a.backgroundPrimary === b.backgroundPrimary &&
    a.trackAreaBackground === b.trackAreaBackground &&
    a.trackBackground === b.trackBackground
  );
}

function isCatalogItemSelected(
  item: BaseThemeColorPaletteCatalogItem,
  normalized: ReturnType<typeof normalizeBasicThemePaletteSettings>,
): boolean {
  if (item.id === 'custom' && item.isCustom && !item.userSavedId) {
    return normalized.paletteId === 'custom' && !normalized.basicActiveUserPaletteId;
  }
  if (item.userSavedId) {
    return (
      normalized.paletteId === 'custom' && normalized.basicActiveUserPaletteId === item.userSavedId
    );
  }
  return normalized.paletteId === item.id;
}

const BASIC_CUSTOM_COLOR_FIELDS = [
  { key: 'accentPrimary', paletteKey: 'accentPrimary', label: 'Акцент' },
  { key: 'textPrimary', paletteKey: 'textPrimary', label: 'Основной текст' },
  { key: 'backgroundPrimary', paletteKey: 'backgroundPrimary', label: 'Фон страницы' },
  { key: 'trackAreaBackground', paletteKey: 'trackAreaBackground', label: 'Фон списка' },
  { key: 'trackBackground', paletteKey: 'trackBackground', label: 'Фон трека' },
] as const;

type BasicCustomField = (typeof BASIC_CUSTOM_COLOR_FIELDS)[number];

const FAMILY_ACCENT_PRESETS: Record<
  BaseThemeFamilyPaletteId,
  readonly { id: string; label: string; accent: string }[]
> = {
  darkGradient: BASIC_THEME_DARK_GRADIENT_PRESETS,
  lightGradient: BASIC_THEME_LIGHT_GRADIENT_PRESETS,
  darkNeon: BASIC_THEME_DARK_NEON_PRESETS,
  lightAccent: BASIC_THEME_LIGHT_ACCENT_PRESETS,
};

function getBasicPalettePreviewStyle(
  paletteItem: BaseThemeColorPaletteCatalogItem,
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
  const [savePaletteNameDraft, setSavePaletteNameDraft] = useState('');

  const basicPaletteSettings = normalizeBasicThemePaletteSettings(customizationSettings);
  const basicPaletteCatalog = buildBasicThemePaletteCatalog(basicPaletteSettings);

  const handleBasicCustomColorChange = (field: BasicCustomField, nextHex: string) => {
    const nextCustom = {
      ...basicPaletteSettings.customPalette,
      [field.paletteKey]: nextHex,
    };
    const activeId = basicPaletteSettings.basicActiveUserPaletteId;
    const list = basicPaletteSettings.basicUserSavedPalettes ?? [];
    if (activeId && list.some((s) => s.id === activeId)) {
      const nextList = list.map((s) => (s.id === activeId ? { ...s, palette: nextCustom } : s));
      onCustomizationSettingsChange({
        ...customizationSettings,
        paletteId: 'custom',
        basicActiveUserPaletteId: activeId,
        customPalette: nextCustom,
        basicUserSavedPalettes: nextList,
      });
      return;
    }
    onCustomizationSettingsChange({
      ...customizationSettings,
      paletteId: 'custom',
      basicActiveUserPaletteId: null,
      customPalette: nextCustom,
    });
  };

  const handleResetUserSavedToOriginal = () => {
    const activeId = basicPaletteSettings.basicActiveUserPaletteId;
    const list = basicPaletteSettings.basicUserSavedPalettes ?? [];
    const entry = activeId ? list.find((s) => s.id === activeId) : undefined;
    if (!entry) {
      return;
    }
    const restored = { ...entry.originalPalette };
    const nextList = list.map((s) => (s.id === activeId ? { ...s, palette: restored } : s));
    onCustomizationSettingsChange({
      ...customizationSettings,
      paletteId: 'custom',
      basicActiveUserPaletteId: activeId,
      customPalette: restored,
      basicUserSavedPalettes: nextList,
    });
  };

  const handleBasicPaletteSelect = (catalogId: string) => {
    setHexDrafts({});

    const userSavedId = parseBasicThemeUserSavedCatalogId(catalogId);
    if (userSavedId) {
      const entry = basicPaletteSettings.basicUserSavedPalettes?.find((s) => s.id === userSavedId);
      if (entry) {
        onCustomizationSettingsChange({
          ...customizationSettings,
          paletteId: 'custom',
          basicActiveUserPaletteId: userSavedId,
          customPalette: { ...entry.palette },
        });
      }
      return;
    }

    if (catalogId === 'custom') {
      const wasAlreadyManual = basicPaletteSettings.paletteId === 'custom';
      onCustomizationSettingsChange({
        ...customizationSettings,
        paletteId: 'custom',
        basicActiveUserPaletteId: wasAlreadyManual
          ? basicPaletteSettings.basicActiveUserPaletteId
          : null,
        customPalette: wasAlreadyManual
          ? basicPaletteSettings.customPalette
          : { ...basicPaletteSettings.customPalette },
      });
      return;
    }

    const selectedPalette = basicPaletteCatalog.find(
      (paletteItem) => paletteItem.id === catalogId && !paletteItem.isCustom,
    )?.palette;

    if (!selectedPalette) {
      if (isBasicThemePaletteId(catalogId)) {
        onCustomizationSettingsChange({
          ...customizationSettings,
          basicActiveUserPaletteId: null,
          paletteId: catalogId,
          customPalette: getDefaultBasicThemeCustomPalette(catalogId),
        });
      }
      return;
    }

    if (isBasicThemeFamilyPaletteId(catalogId)) {
      const nextCustom = buildBasicFamilyCustomPalette(catalogId, selectedPalette.accentPrimary);
      onCustomizationSettingsChange({
        ...customizationSettings,
        basicActiveUserPaletteId: null,
        paletteId: catalogId,
        customPalette: nextCustom,
      });
      return;
    }

    onCustomizationSettingsChange({
      ...customizationSettings,
      basicActiveUserPaletteId: null,
      paletteId: catalogId as typeof basicPaletteSettings.paletteId,
      customPalette: {
        accentPrimary: selectedPalette.accentPrimary,
        textPrimary: selectedPalette.textPrimary,
        backgroundPrimary: selectedPalette.backgroundPrimary,
        trackAreaBackground: selectedPalette.trackAreaBackground,
        trackBackground: selectedPalette.trackBackground,
      },
    });
  };

  const handleUserSavedPaletteDelete = (savedId: string) => {
    const list = basicPaletteSettings.basicUserSavedPalettes ?? [];
    const nextList = list.filter((s) => s.id !== savedId);
    let nextActive = basicPaletteSettings.basicActiveUserPaletteId;
    if (nextActive === savedId) {
      nextActive = null;
    }
    onCustomizationSettingsChange({
      ...customizationSettings,
      basicUserSavedPalettes: nextList,
      basicActiveUserPaletteId: nextActive,
    });
  };

  const handleSaveCurrentPalette = () => {
    const name = savePaletteNameDraft.trim().slice(0, 48);
    if (!name) {
      return;
    }
    const id = createBasicUserPaletteId();
    const snapshot = { ...basicPaletteSettings.customPalette };
    const entry: BaseThemeUserSavedPalette = {
      id,
      name,
      palette: snapshot,
      originalPalette: { ...snapshot },
    };
    const next: BaseThemeUserSavedPalette[] = [
      ...(basicPaletteSettings.basicUserSavedPalettes ?? []),
      entry,
    ];
    setSavePaletteNameDraft('');
    const savingFromFamily = isBasicThemeFamilyPaletteId(basicPaletteSettings.paletteId);
    onCustomizationSettingsChange({
      ...customizationSettings,
      basicUserSavedPalettes: next,
      ...(savingFromFamily
        ? { basicActiveUserPaletteId: null }
        : {
            paletteId: 'custom',
            basicActiveUserPaletteId: id,
            customPalette: { ...basicPaletteSettings.customPalette },
          }),
    });
  };

  const handleFamilyAccentPreset = (familyId: BaseThemeFamilyPaletteId, accentHex: string) => {
    setHexDrafts((prev) => ({ ...prev, familyAccent: accentHex }));
    onCustomizationSettingsChange({
      ...customizationSettings,
      basicActiveUserPaletteId: null,
      paletteId: familyId,
      customPalette: buildBasicFamilyCustomPalette(familyId, accentHex),
    });
  };

  const handleFamilyAccentColorChange = (familyId: BaseThemeFamilyPaletteId, nextHex: string) => {
    setHexDrafts((prev) => ({ ...prev, familyAccent: nextHex }));
    onCustomizationSettingsChange({
      ...customizationSettings,
      basicActiveUserPaletteId: null,
      paletteId: familyId,
      customPalette: buildBasicFamilyCustomPalette(familyId, nextHex),
    });
  };

  const activeUserSavedEntry = basicPaletteSettings.basicActiveUserPaletteId
    ? (basicPaletteSettings.basicUserSavedPalettes ?? []).find(
        (s) => s.id === basicPaletteSettings.basicActiveUserPaletteId,
      )
    : undefined;

  const familyIdForAccent =
    basicPaletteSettings.paletteId !== 'custom' &&
    isBasicThemeFamilyPaletteId(basicPaletteSettings.paletteId)
      ? basicPaletteSettings.paletteId
      : null;

  const familyAccentResolved = familyIdForAccent
    ? basicPaletteSettings.customPalette.accentPrimary
    : '';
  const familyAccentDraft = hexDrafts.familyAccent ?? familyAccentResolved;

  const showSaveNamedPalette =
    basicPaletteSettings.paletteId === 'custom' ||
    isBasicThemeFamilyPaletteId(basicPaletteSettings.paletteId);

  const handleResetBasicPalette = () => {
    setHexDrafts({});
    onCustomizationSettingsChange({
      ...customizationSettings,
      paletteId: DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS.paletteId,
      customPalette: { ...DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS.customPalette },
      basicActiveUserPaletteId: null,
    });
  };

  return (
    <div className="party-editor-section">
      <div className="party-editor-label party-editor-label--row">
        <span>Палитра базовой темы</span>
        <button
          type="button"
          className="party-editor-button party-editor-button-secondary party-editor-palette-reset"
          onClick={handleResetBasicPalette}
          disabled={isDefaultBasicThemeSelection(customizationSettings)}
        >
          Сбросить изменения
        </button>
      </div>
      <div className="party-editor-basic-palette-grid">
        {basicPaletteCatalog.map((paletteItem) => {
          const isSelected = isCatalogItemSelected(paletteItem, basicPaletteSettings);
          const showDelete = Boolean(paletteItem.userSavedId);
          return (
            <div key={paletteItem.id} className="party-editor-palette-cell">
              {showDelete && paletteItem.userSavedId && (
                <button
                  type="button"
                  className="party-editor-palette-delete"
                  title="Удалить палитру"
                  aria-label={`Удалить палитру «${paletteItem.label}»`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUserSavedPaletteDelete(paletteItem.userSavedId!);
                  }}
                >
                  ×
                </button>
              )}
              <button
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
            </div>
          );
        })}
      </div>

      {familyIdForAccent && (
        <div className="party-editor-family-accent">
          <div className="party-editor-family-accent-label">Акцент</div>
          <div className="party-editor-accent-preset-row" role="list">
            {FAMILY_ACCENT_PRESETS[familyIdForAccent].map((preset) => {
              const isSelectedPreset =
                preset.accent.toLowerCase() === familyAccentResolved.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="listitem"
                  className={`party-editor-accent-preset-chip ${isSelectedPreset ? 'party-editor-accent-preset-chip--selected' : ''}`}
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={isSelectedPreset}
                  style={{ ['--accent-chip' as string]: preset.accent }}
                  onClick={() => handleFamilyAccentPreset(familyIdForAccent, preset.accent)}
                />
              );
            })}
          </div>
          <div className="party-editor-custom-color-row party-editor-family-accent-picker-row">
            <label className="party-editor-custom-color-label" htmlFor="basic-family-accent-color">
              HEX
            </label>
            <div className="party-editor-custom-color-controls">
              <input
                id="basic-family-accent-color"
                type="color"
                value={familyAccentResolved}
                onChange={(e) => {
                  const normalized = normalizeHexColor(e.target.value) ?? familyAccentResolved;
                  setHexDrafts((prev) => ({ ...prev, familyAccent: normalized }));
                  handleFamilyAccentColorChange(familyIdForAccent, normalized);
                }}
                className="party-editor-custom-color-picker"
                aria-label="Акцент — выбор цвета"
              />
              <input
                type="text"
                value={familyAccentDraft}
                onChange={(e) => {
                  const value = e.target.value;
                  setHexDrafts((prev) => ({ ...prev, familyAccent: value }));
                  const normalized = normalizeHexColor(value);
                  if (normalized) {
                    handleFamilyAccentColorChange(familyIdForAccent, normalized);
                  }
                }}
                onBlur={() => {
                  const normalized = normalizeHexColor(hexDrafts.familyAccent ?? '');
                  const fallback = familyAccentResolved;
                  const nextValue = normalized ?? fallback;
                  setHexDrafts((prev) => ({ ...prev, familyAccent: nextValue }));
                  handleFamilyAccentColorChange(familyIdForAccent, nextValue);
                }}
                placeholder="#ffffff"
                className="party-editor-input party-editor-custom-color-hex-input"
                aria-label="Акцент — HEX"
              />
            </div>
          </div>
        </div>
      )}

      {showSaveNamedPalette && (
        <div className="party-editor-save-palette-row">
          <label className="party-editor-custom-color-label" htmlFor="basic-save-palette-name">
            Сохранить как палитру
          </label>
          <div className="party-editor-save-palette-controls">
            <input
              id="basic-save-palette-name"
              type="text"
              value={savePaletteNameDraft}
              onChange={(e) => setSavePaletteNameDraft(e.target.value)}
              className="party-editor-input party-editor-save-palette-name"
              placeholder="Название"
              maxLength={48}
              aria-label="Название сохраняемой палитры"
            />
            <button
              type="button"
              className="party-editor-button party-editor-button-secondary"
              onClick={handleSaveCurrentPalette}
              disabled={!savePaletteNameDraft.trim()}
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      {activeUserSavedEntry && (
        <div className="party-editor-user-saved-palette-row">
          <button
            type="button"
            className="party-editor-button party-editor-button-secondary"
            onClick={handleResetUserSavedToOriginal}
            disabled={areBasicCustomPalettesEqual(
              basicPaletteSettings.customPalette,
              activeUserSavedEntry.originalPalette,
            )}
          >
            Сбросить к изначальному сохранению
          </button>
        </div>
      )}

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
                        normalizeHexColor(e.target.value) ??
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
                      const normalized = normalizeHexColor(value);
                      if (normalized) {
                        handleBasicCustomColorChange(field, normalized);
                      }
                    }}
                    onBlur={() => {
                      const normalized = normalizeHexColor(hexDrafts[field.key] ?? '');
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
