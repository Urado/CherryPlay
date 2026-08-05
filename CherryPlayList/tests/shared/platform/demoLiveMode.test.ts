import { isDemoFixturesMode, isDemoLiveMode } from '../../../src/shared/platform/demoLiveMode';

describe('demoLiveMode helpers', () => {
  const originalDemoLive = process.env.VITE_DEMO_LIVE;
  const originalAppMode = process.env.VITE_APP_MODE;

  afterEach(() => {
    if (originalDemoLive === undefined) {
      delete process.env.VITE_DEMO_LIVE;
    } else {
      process.env.VITE_DEMO_LIVE = originalDemoLive;
    }
    if (originalAppMode === undefined) {
      delete process.env.VITE_APP_MODE;
    } else {
      process.env.VITE_APP_MODE = originalAppMode;
    }
  });

  test('isDemoLiveMode is true only when VITE_DEMO_LIVE is 1', () => {
    process.env.VITE_DEMO_LIVE = '1';
    expect(isDemoLiveMode()).toBe(true);
    process.env.VITE_DEMO_LIVE = '0';
    expect(isDemoLiveMode()).toBe(false);
    delete process.env.VITE_DEMO_LIVE;
    expect(isDemoLiveMode()).toBe(false);
  });

  test('isDemoFixturesMode requires demo app mode without live flag', () => {
    process.env.VITE_APP_MODE = 'demo';
    delete process.env.VITE_DEMO_LIVE;
    expect(isDemoFixturesMode()).toBe(true);

    process.env.VITE_DEMO_LIVE = '1';
    expect(isDemoFixturesMode()).toBe(false);

    delete process.env.VITE_APP_MODE;
    delete process.env.VITE_DEMO_LIVE;
    expect(isDemoFixturesMode()).toBe(false);
  });

  test('isDemoFixturesMode accepts explicit appMode for gating', () => {
    delete process.env.VITE_APP_MODE;
    delete process.env.VITE_DEMO_LIVE;
    expect(isDemoFixturesMode('demo')).toBe(true);
    expect(isDemoFixturesMode('electron')).toBe(false);

    process.env.VITE_DEMO_LIVE = '1';
    expect(isDemoFixturesMode('demo')).toBe(false);
  });
});
