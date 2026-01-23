/**
 * Storage адаптер для Zustand persist middleware
 * Использует localforage (IndexedDB) вместо localStorage для надёжного хранения в Electron
 * 
 * Преимущества:
 * - Асинхронное хранение (не блокирует UI)
 * - Надёжное сохранение при спящем режиме
 * - Поддержка больших объёмов данных
 * - Автоматический выбор лучшего драйвера (IndexedDB > WebSQL > localStorage)
 */
import localforage from 'localforage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

// Настройка localforage для Electron
const storage = localforage.createInstance({
  name: 'CherryPlayList',
  storeName: 'app-storage',
  description: 'CherryPlayList application storage',
  // Используем IndexedDB как приоритетный драйвер
  driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
});

/**
 * Storage адаптер для Zustand persist middleware
 * Соответствует интерфейсу PersistStorage из Zustand
 */
export const electronStorage: PersistStorage<unknown> = {
  getItem: async (name: string): Promise<StorageValue<unknown> | null> => {
    try {
      const value = await storage.getItem<string>(name);
      if (value === null) {
        return null;
      }
      // Zustand persist ожидает StorageValue объект
      return JSON.parse(value) as StorageValue<unknown>;
    } catch (error) {
      console.error(`Error getting item "${name}" from storage:`, error);
      return null;
    }
  },
  setItem: async (name: string, value: StorageValue<unknown>): Promise<void> => {
    try {
      // Zustand persist передаёт StorageValue объект, сериализуем его
      await storage.setItem(name, JSON.stringify(value));
    } catch (error) {
      // Улучшенная обработка ошибок для диагностики проблем с сериализацией
      if (error instanceof Error && error.message.includes('could not be cloned')) {
        console.error(
          `Error: Cannot store "${name}" - contains non-serializable data (functions, classes, etc.).`,
        );
        console.error(
          `Make sure the store uses 'partialize' to exclude methods and only save serializable data.`,
        );
      }
      console.error(`Error setting item "${name}" in storage:`, error);
      throw error;
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await storage.removeItem(name);
    } catch (error) {
      console.error(`Error removing item "${name}" from storage:`, error);
      throw error;
    }
  },
};
