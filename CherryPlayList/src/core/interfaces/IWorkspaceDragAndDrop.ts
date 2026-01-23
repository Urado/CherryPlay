import { WorkspaceId } from '../../modules/dragDrop/types';
import { Track } from '../types/track';

/**
 * Опции для drag-and-drop операций в workspace
 */
export interface WorkspaceDragAndDropOptions {
  /**
   * Идентификатор workspace
   */
  workspaceId: WorkspaceId;

  /**
   * Треки в workspace
   */
  tracks: Track[];

  /**
   * Выбранные треки
   */
  selectedTrackIds: Set<string>;

  /**
   * Проверка, является ли файл аудио
   */
  isValidAudioFile: (path: string) => boolean;

  /**
   * Обработчик перемещения трека
   */
  onMoveTrack: (from: number, to: number) => void;

  /**
   * Обработчик перемещения выбранных треков
   */
  onMoveSelectedTracks: (toIndex: number) => void;

  /**
   * Обработчик добавления треков
   */
  onAddTracks: (tracks: Omit<Track, 'id'>[]) => void;

  /**
   * Обработчик добавления треков в определенную позицию
   */
  onAddTracksAt: (tracks: Omit<Track, 'id'>[], index: number) => void;

  /**
   * Обработчик после добавления треков (опционально)
   */
  onTracksAdded?: (paths: string[]) => void;

  /**
   * Загрузка треков из папки (опционально)
   */
  loadFolderTracks?: (folderPath: string) => Promise<string[]>;
}

/**
 * Интерфейс для drag-and-drop функциональности workspace
 */
export interface IWorkspaceDragAndDrop {
  /**
   * Начать перетаскивание
   */
  startDrag: (trackIds: Set<string>) => void;

  /**
   * Завершить перетаскивание
   */
  endDrag: () => void;

  /**
   * Обработать drop
   */
  handleDrop: (targetIndex: number, isCopy?: boolean) => void;
}
