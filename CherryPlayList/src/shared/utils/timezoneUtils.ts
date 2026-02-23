/**
 * Утилиты для работы с таймзонами
 */

/**
 * Получить список популярных таймзон (Россия и СНГ)
 */
export function getPopularTimeZones(): Array<{ value: string; label: string }> {
  return [
    { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
    { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
    { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
    { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
    { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
    { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
    { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
    { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
    { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
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

/**
 * Конвертировать UTC дату в дату указанной таймзоны для datetime-local input
 */
export function convertUtcToLocalDateTime(utcDate: string, timeZone: string): string {
  try {
    const date = new Date(utcDate);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    });
    return formatter.format(date).replace(', ', 'T');
  } catch {
    return '';
  }
}

/**
 * Конвертировать локальную дату из datetime-local input в UTC с учетом таймзоны
 */
export function convertLocalDateTimeToUtc(localDateTime: string, timeZone: string): string {
  try {
    // Создаем дату в указанной таймзоне
    const [datePart, timePart] = localDateTime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    // Используем Intl API для конвертации
    const dateInTimezone = new Date(
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      }).formatToParts(new Date(year, month - 1, day, hours, minutes)),
    );

    return dateInTimezone.toISOString();
  } catch {
    return new Date(localDateTime).toISOString();
  }
}
