const removeItem = jest.fn(async () => undefined);

jest.mock('../../../src/shared/storage/electronStorage', () => ({
  electronStorage: {
    removeItem: (...args: unknown[]) => removeItem(...args),
  },
}));

import {
  DEMO_AUTH_PERSIST_STORAGE_KEY,
  DEMO_PERSIST_STORAGE_KEYS,
  resetDemoPersistStorage,
} from '../../../src/shared/demo/demoResetStorage';

describe('resetDemoPersistStorage', () => {
  const originalDemoLive = process.env.VITE_DEMO_LIVE;

  beforeEach(() => {
    removeItem.mockClear();
  });

  afterEach(() => {
    if (originalDemoLive === undefined) {
      delete process.env.VITE_DEMO_LIVE;
    } else {
      process.env.VITE_DEMO_LIVE = originalDemoLive;
    }
  });

  test('fixtures mode clears auth and other demo persist keys', async () => {
    delete process.env.VITE_DEMO_LIVE;
    await resetDemoPersistStorage();

    expect(removeItem.mock.calls.map((call) => call[0]).sort()).toEqual(
      [...DEMO_PERSIST_STORAGE_KEYS].sort(),
    );
  });

  test('live mode keeps cherryplaylist-auth and clears other keys', async () => {
    process.env.VITE_DEMO_LIVE = '1';
    await resetDemoPersistStorage();

    const removed = removeItem.mock.calls.map((call) => call[0]);
    expect(removed).not.toContain(DEMO_AUTH_PERSIST_STORAGE_KEY);
    expect(removed.sort()).toEqual(
      DEMO_PERSIST_STORAGE_KEYS.filter((key) => key !== DEMO_AUTH_PERSIST_STORAGE_KEY).sort(),
    );
  });
});
