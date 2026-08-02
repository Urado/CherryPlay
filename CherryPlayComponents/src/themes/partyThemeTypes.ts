export type PartyThemeId = 'cyberpunk' | 'sakura' | 'art-deco' | 'basic' | 'spring-cross-step';

export const DEFAULT_PARTY_THEME_ID: PartyThemeId = 'basic';

export interface ThemeCustomizationEditorProps {
  customizationSettings: Record<string, unknown>;
  onCustomizationSettingsChange: (settings: Record<string, unknown>) => void;
}
