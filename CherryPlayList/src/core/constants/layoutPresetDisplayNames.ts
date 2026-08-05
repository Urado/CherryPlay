import type { LayoutPreset } from '@core/types/workspacePreset';

export const LAYOUT_PRESET_DISPLAY_NAMES_RU: Record<LayoutPreset, string> = {
  simple: 'Простая сборка',
  complex: 'Сложный',
  collections: 'Сборка плейлиста',
  'collections-vertical': 'Сборка плейлиста',
  player: 'Играть и править',
  party: 'Играть для гостей',
  'aimp-party': 'AIMP + Party',
};

export const LAYOUT_PRESET_DESCRIPTIONS_RU: Partial<Record<LayoutPreset, string>> = {
  simple: 'Плейлист и панель файлов — минимум панелей',
  'collections-vertical': 'Вертикальная раскладка: подборки (буфер) и файлы',
  player: 'Играть локально и править список / файлы в одной раскладке',
  party: 'Вечеринка для гостей: настройка и превью страницы',
};

export function getLayoutPresetDescriptionRu(preset: LayoutPreset): string | undefined {
  return LAYOUT_PRESET_DESCRIPTIONS_RU[preset];
}
