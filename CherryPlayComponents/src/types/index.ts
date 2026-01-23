/**
 * Типы для библиотеки компонентов CherryPlay
 */

export interface PlayerItem {
  id: string;
  type: 'track' | 'group';
  name: string;
  // Для трека
  path?: string;
  duration?: number;
  // Для группы
  items?: PlayerItem[];
  // Общее
  displayOrder: number;
  level: number; // Уровень вложенности (0 для корневых)
}

export interface PlaybackState {
  currentTrackId: string | null;
  status: 'idle' | 'playing' | 'paused' | 'ended';
  position: number; // в секундах
  duration: number; // в секундах
  volume: number; // 0-1
  mode: 'preparation' | 'session';
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  lastUpdatedAt: string;
}

export interface PartyPlaylistData {
  items: PlayerItem[];
  totalDuration: number;
  totalTracks: number;
}

/**
 * Единый объект данных для отображения вечеринки
 * Содержит всю необходимую информацию для рендеринга
 */
export interface PartyDisplayData {
  // Метаданные вечеринки
  partyId: string;
  partyName: string;
  
  // Тема и кастомизация
  themeId: string; // ThemeId
  customizationSettings?: Record<string, any>;
  
  // Данные плейлиста
  playlist: PartyPlaylistData;
  
  // Состояние воспроизведения (опционально)
  playbackState?: PlaybackState | null;
  
  // Статус сессии
  isSessionActive: boolean;
}

