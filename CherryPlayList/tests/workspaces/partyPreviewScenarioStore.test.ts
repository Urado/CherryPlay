jest.mock('@cherryplay/components', () => ({
  getDefaultCustomizationSettings: (themeId: string) => ({ theme: themeId }),
}));

import {
  detachPreview,
  resetPreviewScenario,
  setPreviewConnectionBreak,
  setPreviewCustomizationSettings,
  setPreviewLifecycleOverride,
  setPreviewMockLive,
  setPreviewTheme,
  setPreviewTrackNumber,
  syncPreviewWithProduction,
} from '../../src/workspaces/party/partyPreviewScenarioActions';
import {
  initialPartyPreviewScenarioState,
  resetPartyPreviewScenarioStore,
  usePartyPreviewScenarioStore,
} from '../../src/workspaces/party/partyPreviewScenarioStore';

describe('partyPreviewScenarioStore', () => {
  beforeEach(() => {
    resetPartyPreviewScenarioStore();
  });

  it('starts with documented initial state', () => {
    expect(usePartyPreviewScenarioStore.getState()).toEqual(initialPartyPreviewScenarioState);
  });

  it('syncPreviewWithProduction restores synchronized defaults', () => {
    setPreviewMockLive();
    setPreviewTheme('retro');
    setPreviewLifecycleOverride('completed');

    syncPreviewWithProduction();

    expect(usePartyPreviewScenarioStore.getState()).toEqual(initialPartyPreviewScenarioState);
  });

  it('detachPreview only clears synchronization flag', () => {
    setPreviewLifecycleOverride('ready');

    detachPreview();

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      lifecycleOverride: 'ready',
      mockLiveEnabled: false,
    });
  });

  it('setPreviewLifecycleOverride enters detached mode and clears live playback fields', () => {
    setPreviewMockLive();

    setPreviewLifecycleOverride('draft');

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      lifecycleOverride: 'draft',
      mockLiveEnabled: false,
      viewerStatusOverride: null,
      currentTrackNumber: null,
    });
  });

  it('setPreviewMockLive enables mock live with ready lifecycle and default track', () => {
    setPreviewMockLive();

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      lifecycleOverride: 'ready',
      mockLiveEnabled: true,
      viewerStatusOverride: null,
      currentTrackNumber: 1,
    });
  });

  it('setPreviewTrackNumber normalizes and enables mock live', () => {
    setPreviewTrackNumber(3.7);

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      lifecycleOverride: 'ready',
      mockLiveEnabled: true,
      currentTrackNumber: 3,
      viewerStatusOverride: null,
    });
  });

  it('setPreviewConnectionBreak applies viewer status override and mock live', () => {
    setPreviewConnectionBreak('server_unreachable');

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      lifecycleOverride: 'ready',
      mockLiveEnabled: true,
      viewerStatusOverride: 'server_unreachable',
      currentTrackNumber: 1,
    });
  });

  it('setPreviewConnectionBreak preserves currentTrackNumber when switching scenarios', () => {
    setPreviewTrackNumber(3);
    setPreviewConnectionBreak('server_unreachable');

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      lifecycleOverride: 'ready',
      mockLiveEnabled: true,
      viewerStatusOverride: 'server_unreachable',
      currentTrackNumber: 3,
    });
  });

  it('setPreviewTheme applies theme and default customization when missing', () => {
    setPreviewTheme('retro');

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      themeOverride: 'retro',
      customizationSettingsOverride: { theme: 'retro' },
    });
  });

  it('setPreviewTheme preserves existing customization override', () => {
    const settings = { accent: 'pink' };
    setPreviewCustomizationSettings(settings);
    setPreviewTheme('retro');

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      themeOverride: 'retro',
      customizationSettingsOverride: settings,
    });
  });

  it('setPreviewCustomizationSettings stores detached customization only', () => {
    const settings = { accent: 'pink' };
    setPreviewCustomizationSettings(settings);

    expect(usePartyPreviewScenarioStore.getState()).toMatchObject({
      isSynchronized: false,
      customizationSettingsOverride: settings,
    });
  });

  it('resetPreviewScenario restores full initial state', () => {
    setPreviewMockLive();
    setPreviewTheme('retro');
    setPreviewConnectionBreak('connecting');

    resetPreviewScenario();

    expect(usePartyPreviewScenarioStore.getState()).toEqual(initialPartyPreviewScenarioState);
  });
});
