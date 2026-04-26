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
    // База — «сейчас» в wall-clock. Границы трека на таймлайне и остаток очереди
    // сдвигаются на −currentTrackPosition в calculateDividerMarkers / plannedEnd
    // и в calculateAccumulatedDuration, чтобы тайм не дрейфовал каждую секунду.
    currentRealTime = Date.now();
    currentTimeOffset = 0; // смещение внутри трека учитывается при расчёте отрезков, не здесь
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
 * Секунды до конца трека и далее по очереди: в сессии на активном треке
 * — остаток (duration − currentTrackPosition), иначе полная длительность.
 */
function getSessionOrFullTrackDurationSeconds(
  context: DividerCalculationContext,
  track: Track,
): number {
  const full = context.calculateTrackDurationWithPause(track);
  if (context.mode !== 'session' || context.activeTrackId !== track.id) {
    return full;
  }
  if (context.isTrackPlayed(track.id)) {
    return full;
  }
  const pos = context.currentTrackPosition;
  if (pos === undefined || pos <= 0) {
    return full;
  }
  return Math.max(0, full - Math.min(pos, full));
}

/**
 * В сессии сдвигает нулевую точку накопления к началу трека в wall time:
 * trackStart = now − pos, trackEnd = trackStart + full.
 */
function shiftAccumulatedForSessionCurrentTrackStart(
  context: DividerCalculationContext,
  track: Track,
  accumulatedDuration: number,
): number {
  if (
    context.mode !== 'session' ||
    context.isTrackPlayed(track.id) ||
    context.activeTrackId !== track.id
  ) {
    return accumulatedDuration;
  }
  const pos = context.currentTrackPosition;
  if (pos === undefined || pos <= 0) {
    return accumulatedDuration;
  }
  const full = context.calculateTrackDurationWithPause(track);
  return accumulatedDuration - Math.min(pos, full);
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
  const { mode, isTrackDisabled, isTrackPlayed } = context;

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

    const trackDuration = getSessionOrFullTrackDurationSeconds(context, track);
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
  /** time — для отрисовки в session: при плане внутри трека — граница сегмента (trackEnd), как у интервальных отсечек; иначе plannedEndTime */
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
    // В режиме сессии: now — текущий момент; для активного трека
    // start в прошлом на currentTrackPosition, конец = start + full.
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

      const fullTrackDuration = context.calculateTrackDurationWithPause(track);
      accumulatedDuration = shiftAccumulatedForSessionCurrentTrackStart(
        context,
        track,
        accumulatedDuration,
      );

      // Проверяем, попадает ли отсечка внутри этого трека
      // Для этого проверяем ДО того, как добавим длительность трека
      if (currentRealTime !== null) {
        // Время начала трека (в реальном времени)
        const trackStartRealTime = currentRealTime + accumulatedDuration * 1000;
        // Время окончания трека (в реальном времени)
        const trackEndRealTime = trackStartRealTime + fullTrackDuration * 1000;

        // Проверяем обычные отсечки (ровное время)
        if (nextEvenTime !== null) {
          // nextEvenTime попадает внутрь интервала трека: визуально отсечка после трека, в map кладётся
          // wall-clock на конец трека (trackEndRealTime), а не «ровный» nextEvenTime — метка в UI
          // совпадает с границей трека на таймлайне, как в formatSessionDividerLabel.
          if (nextEvenTime >= trackStartRealTime && nextEvenTime <= trackEndRealTime) {
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

      // Отрезок на таймлайне имеет длину full (смещение start уже в accumulated)
      accumulatedDuration += fullTrackDuration;
    }
  }

  return {
    markers,
    startPosition,
    nextEvenTime,
    plannedEndMarker,
  };
}

function padTimePart(value: number): string {
  return Math.max(0, Math.floor(value)).toString().padStart(2, '0');
}

/**
 * Форматирует время из timestamp в формат hh:mm:ss (локальные часы)
 */
export function formatTimeFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`;
}

/**
 * Форматирует длительность в секундах в формат hh:mm:ss
 */
export function formatTimeFromDuration(durationSeconds: number): string {
  const total = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${padTimePart(hours)}:${padTimePart(minutes)}:${padTimePart(seconds)}`;
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

  return formatTimeFromDuration(accumulatedDuration);
}

/**
 * Не больше одной отсечки на строку списка. Приоритет: план — конец очереди — интервал.
 * Используется плеером и плейлистом, чтобы визуальная иерархия совпадала.
 */
export function getPriorityHourDividerKind(
  hasPlannedEndDivider: boolean,
  hasQueueEndDivider: boolean,
  showIntervalDivider: boolean,
): 'planned-end' | 'queue-end' | 'interval' | null {
  if (hasPlannedEndDivider) {
    return 'planned-end';
  }
  if (hasQueueEndDivider) {
    return 'queue-end';
  }
  if (showIntervalDivider) {
    return 'interval';
  }
  return null;
}

/**
 * Позиция отсечки, привязанной к треку в списке отображения (flatIndex строки трека)
 */
export function calculateTrackAnchorDividerPosition<T extends { id: string }>(
  anchor: { trackId: string | null } | null,
  displayItems: Array<{ item: T }>,
  isPlayerTrack: (item: T) => boolean,
): number | null {
  if (anchor === null) {
    return null;
  }

  if (anchor.trackId === null) {
    return -1;
  }

  const trackIdToDisplayIndex = new Map<string, number>();
  displayItems.forEach((di, idx) => {
    if (isPlayerTrack(di.item)) {
      trackIdToDisplayIndex.set(di.item.id, idx);
    }
  });

  const trackDisplayIndex = trackIdToDisplayIndex.get(anchor.trackId);
  return trackDisplayIndex !== undefined ? trackDisplayIndex : null;
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
  return calculateTrackAnchorDividerPosition(
    dividerMarkers.plannedEndMarker,
    displayItems,
    isPlayerTrack,
  );
}

/** Фактический конец текущей очереди / раскладки (не плановое окончание) */
export interface QueueEndMarker {
  trackId: string;
  sessionEndTimestamp: number | null;
  preparationDurationSeconds: number | null;
}

/**
 * Последний учитываемый трек и время конца очереди: в сессии — wall-clock, в подготовке — накопленная длительность.
 */
export function calculateQueueEndMarker(context: DividerCalculationContext): QueueEndMarker | null {
  const { tracks, mode } = context;
  if (tracks.length === 0) {
    return null;
  }

  if (mode === 'preparation') {
    let lastTrackId: string | null = null;
    let totalSeconds = 0;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (context.isTrackDisabled(track.id)) {
        continue;
      }
      totalSeconds += context.calculateTrackDurationWithPause(track);
      lastTrackId = track.id;
    }
    if (lastTrackId === null) {
      return null;
    }
    return {
      trackId: lastTrackId,
      sessionEndTimestamp: null,
      preparationDurationSeconds: totalSeconds,
    };
  }

  const startPosition = calculateStartPosition(context);
  const { startFromIndex, currentRealTime } = startPosition;
  if (currentRealTime === null) {
    return null;
  }

  let accumulatedDuration = 0;
  let lastTrackId: string | null = null;

  for (let i = startFromIndex; i < tracks.length; i++) {
    const track = tracks[i];
    if (context.isTrackDisabled(track.id)) {
      continue;
    }
    if (context.isTrackPlayed(track.id)) {
      continue;
    }
    accumulatedDuration += getSessionOrFullTrackDurationSeconds(context, track);
    lastTrackId = track.id;
  }

  if (lastTrackId === null) {
    return null;
  }

  return {
    trackId: lastTrackId,
    sessionEndTimestamp: currentRealTime + accumulatedDuration * 1000,
    preparationDurationSeconds: null,
  };
}

export function calculateQueueEndDividerPosition<T extends { id: string }>(
  queueEndMarker: QueueEndMarker | null,
  displayItems: Array<{ item: T }>,
  isPlayerTrack: (item: T) => boolean,
): number | null {
  if (queueEndMarker === null) {
    return null;
  }
  return calculateTrackAnchorDividerPosition(
    { trackId: queueEndMarker.trackId },
    displayItems,
    isPlayerTrack,
  );
}

/**
 * Находит позицию планового времени окончания относительно трека
 * @param plannedEndTime - Плановое время окончания (timestamp)
 * @param trackStartRealTime - Время начала трека (timestamp)
 * @param trackEndRealTime - Время окончания трека (timestamp)
 * @param previousTrack - Предыдущий трек или null для первого трека
 * @returns Якорь (trackId) и время подписи в поле time (при плане внутри трека — trackEndRealTime, как у ровных отсечек), или null если искать в следующем треке
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
    // План внутри сегмента трека на таймлайне — подпись по границе сегмента (дрейф/смещение как у интервальных маркеров)
    return {
      trackId: previousTrack?.id ?? null,
      time: trackEndRealTime,
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

    const fullTrackDuration = context.calculateTrackDurationWithPause(track);
    accumulatedDuration = shiftAccumulatedForSessionCurrentTrackStart(
      context,
      track,
      accumulatedDuration,
    );

    // Время начала трека (в реальном времени)
    const trackStartRealTime = currentRealTime + accumulatedDuration * 1000;
    // Время окончания трека (в реальном времени)
    const trackEndRealTime = trackStartRealTime + fullTrackDuration * 1000;

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
    accumulatedDuration += fullTrackDuration;
  }

  // Если не нашли позицию, возвращаем null (отсечка будет показана в конце)
  return null;
}
