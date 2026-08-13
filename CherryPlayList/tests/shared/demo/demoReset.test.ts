jest.mock('@cherryplay/components', () => ({
  DEFAULT_PARTY_THEME_ID: 'default-theme',
}));

const setLinkedParty = jest.fn();
const setPartyThemeId = jest.fn();
const applyDemoAuthSessionMock = jest.fn();
const settingsSetState = jest.fn();

jest.mock('../../../src/shared/demo/demoAuthFixture', () => ({
  applyDemoAuthSession: (...args: unknown[]) => applyDemoAuthSessionMock(...args),
}));

jest.mock('../../../src/shared/stores/projectStore', () => ({
  useProjectStore: {
    getState: () => ({
      setLinkedParty,
      setPartyThemeId,
    }),
  },
}));

jest.mock('../../../src/shared/stores/settingsStore', () => ({
  useSettingsStore: {
    setState: (...args: unknown[]) => settingsSetState(...args),
  },
}));

import { DEMO_LINKED_PARTY } from '../../../src/shared/demo/demoPartyFixture';
import { applyDemoStoreDefaults } from '../../../src/shared/demo/demoReset';

describe('applyDemoStoreDefaults', () => {
  const originalAppMode = process.env.VITE_APP_MODE;
  const originalDemoLive = process.env.VITE_DEMO_LIVE;

  beforeEach(() => {
    setLinkedParty.mockClear();
    setPartyThemeId.mockClear();
    applyDemoAuthSessionMock.mockClear();
    settingsSetState.mockClear();
  });

  afterEach(() => {
    if (originalAppMode === undefined) {
      delete process.env.VITE_APP_MODE;
    } else {
      process.env.VITE_APP_MODE = originalAppMode;
    }
    if (originalDemoLive === undefined) {
      delete process.env.VITE_DEMO_LIVE;
    } else {
      process.env.VITE_DEMO_LIVE = originalDemoLive;
    }
  });

  test('fixtures mode starts unlinked (Не создана), not DEMO_LINKED_PARTY', () => {
    process.env.VITE_APP_MODE = 'demo';
    delete process.env.VITE_DEMO_LIVE;

    applyDemoStoreDefaults();

    expect(applyDemoAuthSessionMock).toHaveBeenCalled();
    expect(setLinkedParty).toHaveBeenCalledWith(null);
    expect(setLinkedParty).not.toHaveBeenCalledWith(DEMO_LINKED_PARTY);
    expect(setPartyThemeId).toHaveBeenCalledWith('default-theme');
    expect(settingsSetState).toHaveBeenCalled();
  });

  test('live mode keeps linkedParty null', () => {
    process.env.VITE_APP_MODE = 'demo';
    process.env.VITE_DEMO_LIVE = '1';

    applyDemoStoreDefaults();

    expect(applyDemoAuthSessionMock).not.toHaveBeenCalled();
    expect(setLinkedParty).toHaveBeenCalledWith(null);
    expect(setPartyThemeId).toHaveBeenCalledWith('default-theme');
  });

  test('non-demo mode is a no-op', () => {
    process.env.VITE_APP_MODE = 'electron';
    delete process.env.VITE_DEMO_LIVE;

    applyDemoStoreDefaults();

    expect(applyDemoAuthSessionMock).not.toHaveBeenCalled();
    expect(setLinkedParty).not.toHaveBeenCalled();
    expect(settingsSetState).not.toHaveBeenCalled();
  });
});
