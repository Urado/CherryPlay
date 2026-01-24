/**
 * Конфигурация API и SignalR
 */

interface ElectronWindow extends Window {
  electron?: {
    api?: {
      getServerUrl?: () => string;
    };
  };
}

// В Electron приложении используем переменные окружения или значения по умолчанию
const getServerUrl = (): string => {
  // Для Electron можно использовать process.env или IPC для получения конфигурации
  // Пока используем значение по умолчанию для разработки
  const electronWindow = window as ElectronWindow;
  if (typeof window !== 'undefined' && electronWindow.electron?.api?.getServerUrl) {
    return electronWindow.electron.api.getServerUrl();
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
