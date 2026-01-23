import { DividerCalculationContext, formatTimeFromDuration } from '@shared/utils/dividerUtils';

/**
 * Форматирует метку отсечки для режима preparation
 * @param trackId - ID трека
 * @param context - Контекст расчета отсечек
 * @returns Отформатированная метка времени
 */
export function formatPreparationDividerLabel(
  trackId: string,
  context: DividerCalculationContext,
): string {
  const { tracks, hourDividerInterval } = context;

  // Находим индекс трека
  const trackIndex = tracks.findIndex((t) => t.id === trackId);
  if (trackIndex === -1 || hourDividerInterval <= 0) {
    return '';
  }

  // Режим подготовки: учитываем паузы между треками
  // Считаем накопленную длительность от начала, пропуская отключенные треки
  let accumulatedDuration = 0;
  for (let i = 0; i <= trackIndex && i < tracks.length; i++) {
    const track = tracks[i];
    // Пропускаем отключённые треки
    if (context.isTrackDisabled(track.id)) {
      continue;
    }
    // Учитываем паузы между треками (как в режиме сессии)
    accumulatedDuration += context.calculateTrackDurationWithPause(track);
  }
  return formatTimeFromDuration(accumulatedDuration);
}
