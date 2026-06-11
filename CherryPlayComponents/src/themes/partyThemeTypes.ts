/** Идентификатор встроенной PartyTheme в пакете `@cherryplay/components`. */
export type PartyThemeId = 'cyberpunk' | 'sakura' | 'art-deco' | 'basic' | 'spring-cross-step';

/** Пропсы редакторов кастомизации темы (PartyDisplay → CustomizationEditor). */
export interface ThemeCustomizationEditorProps {
  customizationSettings: Record<string, unknown>;
  onCustomizationSettingsChange: (settings: Record<string, unknown>) => void;
}
