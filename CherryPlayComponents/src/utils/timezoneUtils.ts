/**
 * Утилиты для работы с таймзонами (общий модуль для List и Web).
 * convertLocalDateTimeToUtc интерпретирует ввод как местное время в заданной IANA таймзоне.
 */

import { DateTime } from 'luxon';

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
 * Форматировать дату в указанной таймзоне (локаль ru-RU)
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
 * Конвертировать UTC дату (ISO) в строку YYYY-MM-DDTHH:mm для datetime-local в заданной таймзоне
 */
export function convertUtcToLocalDateTime(utcDate: string, timeZone: string): string {
  if (!utcDate?.trim()) return '';
  try {
    const dt = DateTime.fromISO(utcDate, { zone: 'utc' }).setZone(timeZone);
    if (!dt.isValid) return '';
    return dt.toFormat("yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

/**
 * Интерпретирует localDateTime как местное время в заданной IANA таймзоне и возвращает ISO UTC.
 * Например: "2025-03-01T21:00" + "Europe/Moscow" → "2025-03-01T18:00:00.000Z"
 */
export function convertLocalDateTimeToUtc(localDateTime: string, timeZone: string): string {
  if (!localDateTime?.trim()) return '';
  try {
    const dt = DateTime.fromISO(localDateTime, { zone: timeZone });
    if (!dt.isValid) return '';
    const iso = dt.toUTC().toISO();
    return iso ?? '';
  } catch {
    return '';
  }
}
