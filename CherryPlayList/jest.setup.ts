import '@testing-library/jest-dom';

jest.mock('localforage', () => {
  const store = new Map<string, unknown>();
  const instance = {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
  };
  return {
    __esModule: true,
    default: {
      createInstance: jest.fn(() => instance),
      INDEXEDDB: 'indexedDB',
      LOCALSTORAGE: 'localStorage',
    },
  };
});
