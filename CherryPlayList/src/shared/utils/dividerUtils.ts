import { Track } from '@core/types/track';

/**
 * Интерфейс для контекста расчета отсечек
 */
export interface DividerCalculationContext {
  tracks: Track[];
  activeTrackId: string | null;
  currentTrackPosition: number | undefined;
  mode: 'preparation' | 'session';
  hourDividerInterval: number; // в секундах
  isTrackDisabled: (trackId: string) => boolean;
  isTrackPlayed: (trackId: string) => boolean;
  calculateTrackDurationWithPause: (track: Track) => number;
}

/**
 * Результат расчета начальной позиции для отсчета
 */
export interface StartPosition {
  startFromIndex: number;
  currentTimeOffset: number; // в секундах
  currentRealTime: number | null; // timestamp или null
}

/**
 * Находит начальный индекс для расчета отсечек
 */
export function findStartIndex(
  tracks: Track[],
  activeTrackId: string | null,
  isTrackDisabled: (trackId: string) => boolean,
  isTrackPlayed: (trackId: string) => boolean,
): number {
  if (activeTrackId) {
    const currentTrackIndex = tracks.findIndex((t) => t.id === activeTrackId);
    if (currentTrackIndex !== -1) {
      return currentTrackIndex;
    }
  }

  // Если текущего трека нет, начинаем с первого активного
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (!isTrackDisabled(track.id) && !isTrackPlayed(track.id)) {
      return i;
    }
  }

  return 0;
}

/**
 * Вычисляет начальную позицию и текущее время для расчета отсечек
 */
export function calculateStartPosition(context: DividerCalculationContext): StartPosition {
  const { tracks, activeTrackId, mode, isTrackDisabled, isTrackPlayed } = context;

  const startFromIndex = findStartIndex(tracks, activeTrackId, isTrackDisabled, isTrackPlayed);

  let currentTimeOffset = 0;
  let currentRealTime: number | null = null;

  if (mode === 'session') {
    // В режиме сессии: используем текущее время как базовую точку
    // Нам не важно когда начали сессию, важно только предсказать будущее
    currentRealTime = Date.now();
    currentTimeOffset = 0; // Не используется, так как используем Date.now()
  }

  return {
    startFromIndex,
    currentTimeOffset,
    currentRealTime,
  };
}

/**
 * Вычисляет следующее ровное время после указанного времени
 */
export function calculateNextEvenTime(currentTime: number, hourDividerInterval: number): number {
  const currentDate = new Date(currentTime);
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const intervalMinutes = hourDividerInterval / 60;

  // Вычисляем следующее ровное время после текущего момента (округление вверх)
  const nextEvenMinutes =
    Math.floor(currentMinutes / intervalMinutes) * intervalMinutes + intervalMinutes;
  const nextEvenDate = new Date(currentDate);
  nextEvenDate.setHours(Math.floor(nextEvenMinutes / 60));
  nextEvenDate.setMinutes(nextEvenMinutes % 60);
  nextEvenDate.setSeconds(0);
  nextEvenDate.setMilliseconds(0);

  return nextEvenDate.getTime();
}

/**
 * Вычисляет накопленную длительность от startIndex до endIndex (включительно)
 */
export function calculateAccumulatedDuration(
  tracks: Track[],
  startIndex: number,
  endIndex: number,
  context: DividerCalculationContext,
): number {
  const { mode, isTrackDisabled, isTrackPlayed, calculateTrackDurationWithPause } = context;

  let accumulatedDuration = 0;

  for (let i = startIndex; i <= endIndex && i < tracks.length; i++) {
    const track = tracks[i];

    // Пропускаем отключённые треки
    if (isTrackDisabled(track.id)) {
      continue;
    }

    // Пропускаем проигранные треки в режиме сессии
    if (mode === 'session' && isTrackPlayed(track.id)) {
      continue;
    }

    // Добавляем длительность трека с учетом паузы
    const trackDuration = calculateTrackDurationWithPause(track);

    accumulatedDuration += trackDuration;
  }

  return accumulatedDuration;
}

/**
 * Результат расчета отсечек
 */
export interface DividerMarkers {
  markers: Map<string, number | null>; // trackId -> timestamp или null
  startPosition: StartPosition;
  nextEvenTime: number | null;
  plannedEndMarker: {
    trackId: string | null;
    time: number | null;
  } | null;
}

/**
 * Вычисляет позиции отсечек
 */
export function calculateDividerMarkers(
  context: DividerCalculationContext & {
    showHourDividers: boolean;
    plannedEndTime?: number | null;
  },
): DividerMarkers {
  const { tracks, hourDividerInterval, showHourDividers, plannedEndTime } = context;

  const markers = new Map<string, number | null>();
  let accumulatedDuration = 0;
  let nextEvenTime: number | null = null;
  let plannedEndMarker: { trackId: string | null; time: number | null } | null = null;

  if (!showHourDividers || hourDividerInterval <= 0 || tracks.length === 0) {
    return {
      markers,
      startPosition: {
        startFromIndex: 0,
        currentTimeOffset: 0,
        currentRealTime: null,
      },
      nextEvenTime: null,
      plannedEndMarker: null,
    };
  }

  const startPosition = calculateStartPosition(context);
  const { startFromIndex, currentRealTime } = startPosition;

  // Вычисляем следующее ровное время для режима сессии
  if (context.mode === 'session' && currentRealTime !== null) {
    nextEvenTime = calculateNextEvenTime(currentRealTime, hourDividerInterval);
  }

  // В режиме подготовки используем логику с учетом пауз между треками
  if (context.mode === 'preparation') {
    // Начинаем с начала списка
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];

      // Пропускаем отключённые треки
      if (context.isTrackDisabled(track.id)) {
        continue;
      }

      // В режиме подготовки учитываем паузы между треками (как в режиме сессии)
      accumulatedDuration += context.calculateTrackDurationWithPause(track);

      // Используем ту же логику, что и в плейлисте
      const intervals = Math.floor(accumulatedDuration / hourDividerInterval);
      if (intervals > markers.size) {
        markers.set(track.id, null);
      }
    }
  } else {
    // В режиме сессии: отсчет от текущего трека и текущего момента
    // currentRealTime уже включает проигранное время до текущего момента
    // accumulatedDuration начинается с 0 и накапливается от текущего трека
    let previousTrack: Track | null = null;

    for (let i = startFromIndex; i < tracks.length; i++) {
      const track = tracks[i];

      // Пропускаем отключённые треки
      if (context.isTrackDisabled(track.id)) {
        continue;
      }

      // Пропускаем проигранные треки (они уже учтены в currentRealTime)
      if (context.isTrackPlayed(track.id)) {
        continue;
      }

      // Добавляем длительность трека с учетом паузы
      const trackDuration = context.calculateTrackDurationWithPause(track);

      // Проверяем, попадает ли отсечка внутри этого трека
      // Для этого проверяем ДО того, как добавим длительность трека
      if (currentRealTime !== null) {
        // Время начала трека (в реальном времени)
        const trackStartRealTime = currentRealTime + accumulatedDuration * 1000;
        // Время окончания трека (в реальном времени)
        const trackEndRealTime = trackStartRealTime + trackDuration * 1000;

        // Проверяем обычные отсечки (ровное время)
        if (nextEvenTime !== null) {
          // Проверяем, попадает ли отсечка внутри трека
          if (nextEvenTime >= trackStartRealTime && nextEvenTime <= trackEndRealTime) {
            // Отсечка попадает внутри трека - сохраняем время отсечки
            markers.set(track.id, trackEndRealTime);
            // Вычисляем следующее ровное время
            nextEvenTime += hourDividerInterval * 1000;
          }
        }

        // Проверяем красную отсечку (плановое время окончания)
        // Для красной отсечки используем округление вверх: если время попадает внутри трека,
        // показываем отсечку после предыдущего трека
        if (
          plannedEndTime !== null &&
          plannedEndTime !== undefined &&
          plannedEndMarker === null &&
          context.mode === 'session'
        ) {
          const position = findPlannedEndPosition(
            plannedEndTime,
            trackStartRealTime,
            trackEndRealTime,
            previousTrack,
          );
          if (position !== null) {
            plannedEndMarker = position;
          }
        }
      }

      // Сохраняем текущий трек как предыдущий для следующей итерации
      previousTrack = track;

      // Накопленная длительность от текущего момента (начинается с 0)
      accumulatedDuration += trackDuration;
    }
  }

  return {
    markers,
    startPosition,
    nextEvenTime,
    plannedEndMarker,
  };
}

/**
 * Форматирует время из timestamp в формат "hh:mm"
 */
export function formatTimeFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Форматирует время из длительности в секундах в формат "hh:mm"
 */
export function formatTimeFromDuration(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Простая функция для расчета отсечек в плейлисте (без учета пауз, отключенных треков и т.д.)
 * Возвращает массив индексов треков, после которых нужно показать отсечку
 */
export function calculateSimpleDividerMarkers(
  tracks: Track[],
  hourDividerInterval: number,
): number[] {
  const markers: number[] = [];
  let accumulatedDuration = 0;

  tracks.forEach((track, index) => {
    accumulatedDuration += track.duration || 0;
    const intervals = Math.floor(accumulatedDuration / hourDividerInterval);

    // Если перешли через новый интервал, добавляем маркер после этого трека
    if (intervals > markers.length) {
      markers.push(index);
    }
  });

  return markers;
}

/**
 * Простая функция для форматирования метки отсечки в плейлисте
 * Показывает время с начала плейлиста
 */
export function formatSimpleDividerLabel(tracks: Track[], index: number): string {
  const accumulatedDuration = tracks
    .slice(0, index + 1)
    .reduce((sum, track) => sum + (track.duration || 0), 0);

  const hours = Math.floor(accumulatedDuration / 3600);
  const minutes = Math.floor((accumulatedDuration % 3600) / 60);

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Вычисляет позицию красной отсечки планового времени окончания
 * Использует данные из calculateDividerMarkers
 */
export function calculatePlannedEndDividerPosition<T extends { id: string }>(
  dividerMarkers: DividerMarkers,
  displayItems: Array<{ item: T }>,
  isPlayerTrack: (item: T) => boolean,
): number | null {
  const { plannedEndMarker } = dividerMarkers;

  if (plannedEndMarker === null) {
    return null;
  }

  // Если trackId === null, это означает, что отсечка должна быть вверху (перед первым элементом)
  if (plannedEndMarker.trackId === null) {
    return -1; // Специальное значение для отображения вверху
  }

  // Создаем Map для быстрого поиска индекса трека в displayItems
  const trackIdToDisplayIndex = new Map<string, number>();
  displayItems.forEach((di, idx) => {
    if (isPlayerTrack(di.item)) {
      trackIdToDisplayIndex.set(di.item.id, idx);
    }
  });

  // Используем Map для быстрого поиска индекса
  const trackDisplayIndex = trackIdToDisplayIndex.get(plannedEndMarker.trackId);
  return trackDisplayIndex !== undefined ? trackDisplayIndex : null;
}

/**
 * Находит позицию планового времени окончания относительно трека
 * @param plannedEndTime - Плановое время окончания (timestamp)
 * @param trackStartRealTime - Время начала трека (timestamp)
 * @param trackEndRealTime - Время окончания трека (timestamp)
 * @param previousTrack - Предыдущий трек или null для первого трека
 * @returns Объект с trackId и time, или null если не найдено
 */
function findPlannedEndPosition(
  plannedEndTime: number,
  trackStartRealTime: number,
  trackEndRealTime: number,
  previousTrack: Track | null,
): { trackId: string | null; time: number | null } | null {
  // Проверяем, попадает ли плановое время окончания до начала первого трека
  if (previousTrack === null && plannedEndTime < trackStartRealTime) {
    // Плановое время попадает до начала первого трека - отсечка вверху
    return {
      trackId: null,
      time: plannedEndTime,
    };
  }

  // Проверяем, попадает ли плановое время окончания внутри или после трека
  if (plannedEndTime >= trackStartRealTime && plannedEndTime <= trackEndRealTime) {
    // Плановое время попадает внутри трека - округляем вверх
    // Используем предыдущий трек, если он есть, иначе null (отсечка вверху)
    return {
      trackId: previousTrack?.id ?? null,
      time: trackStartRealTime,
    };
  }

  // Если plannedEndTime > trackEndRealTime, продолжаем поиск в следующих треках
  return null;
}

/**
 * Вычисляет плановое время окончания плейлиста
 * Использует ту же логику, что и calculateDividerMarkers
 */
export function calculateProjectedEndTime(context: DividerCalculationContext): number | null {
  const { mode } = context;

  if (mode !== 'session') {
    return null;
  }

  const startPosition = calculateStartPosition(context);
  const { startFromIndex, currentRealTime } = startPosition;

  if (currentRealTime === null) {
    return null;
  }

  // Считаем накопленную длительность от текущего трека до конца
  const remainingDuration = calculateAccumulatedDuration(
    context.tracks,
    startFromIndex,
    context.tracks.length - 1,
    context,
  );

  // Вычисляем время окончания: текущее время + оставшаяся длительность
  return currentRealTime + remainingDuration * 1000;
}

/**
 * Вычисляет plannedEndMarker независимо от showHourDividers
 * Используется для красной отсечки, которая должна показываться всегда при наличии plannedEndTime
 */
export function calculatePlannedEndMarker(
  context: DividerCalculationContext,
  plannedEndTime: number | null,
): { trackId: string | null; time: number | null } | null {
  const { mode, tracks } = context;

  if (mode !== 'session' || plannedEndTime === null || plannedEndTime === undefined) {
    return null;
  }

  const startPosition = calculateStartPosition(context);
  const { startFromIndex, currentRealTime } = startPosition;

  if (currentRealTime === null) {
    return null;
  }

  let accumulatedDuration = 0;
  let previousTrack: Track | null = null;

  for (let i = startFromIndex; i < tracks.length; i++) {
    const track = tracks[i];

    // Пропускаем отключённые треки
    if (context.isTrackDisabled(track.id)) {
      continue;
    }

    // Пропускаем проигранные треки
    if (context.isTrackPlayed(track.id)) {
      continue;
    }

    // Добавляем длительность трека с учетом паузы
    const trackDuration = context.calculateTrackDurationWithPause(track);

    // Время начала трека (в реальном времени)
    const trackStartRealTime = currentRealTime + accumulatedDuration * 1000;
    // Время окончания трека (в реальном времени)
    const trackEndRealTime = trackStartRealTime + trackDuration * 1000;

    // Проверяем позицию планового времени окончания
    const position = findPlannedEndPosition(
      plannedEndTime,
      trackStartRealTime,
      trackEndRealTime,
      previousTrack,
    );
    if (position !== null) {
      return position;
    }
    previousTrack = track;
    accumulatedDuration += trackDuration;
  }

  // Если не нашли позицию, возвращаем null (отсечка будет показана в конце)
  return null;
}
