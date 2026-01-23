import {
  DividerCalculationContext,
  DividerMarkers,
  calculateAccumulatedDuration,
  calculateNextEvenTime,
  formatTimeFromTimestamp,
} from '@shared/utils/dividerUtils';

/**
 * Форматирует метку отсечки для режима session
 * @param trackId - ID трека
 * @param context - Контекст расчета отсечек
 * @param dividerMarkers - Результат расчета отсечек
 * @returns Отформатированная метка времени
 */
export function formatSessionDividerLabel(
  trackId: string,
  context: DividerCalculationContext,
  dividerMarkers: DividerMarkers,
): string {
  const { tracks, hourDividerInterval } = context;

  // Находим индекс трека
  const trackIndex = tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1 || hourDividerInterval <= 0) {
    return '';
  }

  // Получаем время отсечки из markers
  const dividerTime = dividerMarkers.markers.get(trackId);

  if (dividerTime !== null && dividerTime !== undefined && dividerTime > 0) {
    // Используем уже вычисленное время из markers
    return formatTimeFromTimestamp(dividerTime);
  }

  // Если время не найдено в markers, вычисляем его
  // Это может произойти, если отсечка была вычислена, но время не было сохранено
  const { startPosition } = dividerMarkers;
  const { startFromIndex, currentRealTime } = startPosition;

  if (currentRealTime === null) {
    return '';
  }

  // Считаем накопленную длительность до этого трека
  // Используем функцию calculateAccumulatedDuration напрямую
  const accumulatedDuration = calculateAccumulatedDuration(
    tracks,
    startFromIndex,
    trackIndex,
    context,
  );

  // Вычисляем будущее реальное время
  const futureRealTime = currentRealTime + accumulatedDuration * 1000;

  // Вычисляем следующее ровное время
  const nextEvenTime = calculateNextEvenTime(currentRealTime, hourDividerInterval);

  // Находим, какое ровное время соответствует этой отсечке
  let currentEvenTime = nextEvenTime;
  while (futureRealTime >= currentEvenTime) {
    currentEvenTime += hourDividerInterval * 1000;
  }

  // Возвращаем предыдущее ровное время (то, которое мы достигли или прошли)
  const prevEvenTime = currentEvenTime - hourDividerInterval * 1000;
  return formatTimeFromTimestamp(prevEvenTime);
}
