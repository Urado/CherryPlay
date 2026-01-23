/**
 * Конфигурация API и SignalR
 */

// В Electron приложении используем переменные окружения или значения по умолчанию
const getServerUrl = (): string => {
  // Для Electron можно использовать process.env или IPC для получения конфигурации
  // Пока используем значение по умолчанию для разработки
  if (typeof window !== 'undefined' && (window as any).electron?.api?.getServerUrl) {
    return (window as any).electron.api.getServerUrl();
  }

  // Fallback на переменную окружения или значение по умолчанию
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

export const apiConfig = {
  /**
   * Базовый URL сервера API
   */
  get serverUrl(): string {
    return getServerUrl();
  },

  /**
   * URL для SignalR Hub
   */
  get signalRUrl(): string {
    return `${this.serverUrl}/partyHub`;
  },

  /**
   * URL для REST API
   */
  get apiUrl(): string {
    return `${this.serverUrl}/api`;
  },
};
