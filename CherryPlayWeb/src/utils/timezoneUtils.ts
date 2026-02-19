/**
 * Утилиты для работы с таймзонами
 */

/**
 * Получить список популярных таймзон с их отображаемыми названиями
 */
export function getPopularTimeZones(): Array<{ value: string; label: string }> {
  return [
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
    { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
    { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
    { value: 'Europe/London', label: 'Лондон (UTC+0)' },
    { value: 'Europe/Paris', label: 'Париж (UTC+1)' },
    { value: 'Europe/Berlin', label: 'Берлин (UTC+1)' },
    { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
    { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8)' },
    { value: 'Asia/Tokyo', label: 'Токио (UTC+9)' },
    { value: 'Asia/Shanghai', label: 'Шанхай (UTC+8)' },
    { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
    { value: 'Australia/Sydney', label: 'Сидней (UTC+10)' },
  ];
}

/**
 * Получить таймзону по умолчанию (из системных настроек браузера)
 */
export function getDefaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Форматировать дату в указанной таймзоне
 */
export function formatDateInTimeZone(
  date: Date | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  };
  return new Intl.DateTimeFormat('ru-RU', { ...defaultOptions, ...options }).format(dateObj);
}
