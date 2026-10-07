jest.mock('@cherryplay/components', () => ({
  convertLocalDateTimeToUtc: (value: string, timeZone: string) => `${value}@${timeZone}`,
  getDefaultTimeZone: () => 'Europe/Moscow',
  getDefaultCustomizationSettings: () => ({}),
  DEFAULT_PARTY_THEME_ID: 'basic',
}));

jest.mock('../../src/workspaces/party/partyWorkspaceUtils', () => ({
  normalizeCustomizationSettings: (settings: Record<string, unknown> | undefined) => settings,
  getGroupDisplayDepth: (settings: Record<string, unknown> | undefined) =>
    typeof settings?.groupDisplayDepth === 'number' ? settings.groupDisplayDepth : 3,
  withGroupDisplayDepth: (settings: Record<string, unknown>, groupDisplayDepth: number) => ({
    ...settings,
    groupDisplayDepth,
  }),
}));

jest.mock('../../src/shared/services/ipcService', () => ({ ipcService: {} }));

jest.mock('../../src/shared/services/loudnessService', () => ({
  normalizeLoadedLoudness: (value: unknown) => value,
}));

import { DEFAULT_PROJECT_SETTINGS } from '../../src/core/types/project';
import { projectService } from '../../src/shared/services/projectService';
import { buildUpdatePartyDto } from '../../src/workspaces/party/partyWorkspaceApiBuilders';
import {
  resetPartyWorkspaceState,
  usePartyWorkspaceStore,
} from '../../src/workspaces/party/partyWorkspaceStore';

const partyMetadata = () => ({
  partyName: 'Test Party',
  partyTitle: '',
  partySubtitle: '',
  themeId: 'basic' as const,
  customizationSettings: usePartyWorkspaceStore.getState().customizationSettings,
  eventDateTime: '',
  eventEndDateTime: '',
  hasInitialEventEndDateTime: false,
  eventEndDateTimeTouched: false,
  description: '',
  place: '',
  city: '',
  schedule: '',
  timeZone: '',
  shortDescription: '',
  externalLinkUrl: '',
  externalLinkText: '',
  danceTags: [],
  isListedInCatalog: false,
});

describe('party group display depth customization setting', () => {
  beforeEach(() => resetPartyWorkspaceState());

  it('defaults to three levels in the customization JSON', () => {
    expect(usePartyWorkspaceStore.getState().groupDisplayDepth).toBe(3);
    expect(buildUpdatePartyDto(partyMetadata()).customizationSettings?.groupDisplayDepth).toBe(3);
  });

  it('retains configured depth in the customization JSON sent to the API', () => {
    usePartyWorkspaceStore.getState().setGroupDisplayDepth(7);

    expect(usePartyWorkspaceStore.getState().groupDisplayDepth).toBe(7);
    expect(usePartyWorkspaceStore.getState().customizationSettings.groupDisplayDepth).toBe(7);
    const payload = buildUpdatePartyDto({
      ...partyMetadata(),
      customizationSettings: usePartyWorkspaceStore.getState().customizationSettings,
    });
    expect(payload.groupDisplayDepth).toBeUndefined();
    expect(payload.customizationSettings?.groupDisplayDepth).toBe(7);
  });

  it('retains the customization depth in a project file roundtrip', () => {
    const projectFile = projectService.serializeProject({
      name: 'Depth settings',
      items: [],
      settings: { ...DEFAULT_PROJECT_SETTINGS },
      trackSettings: new Map(),
      groupSettings: new Map(),
      partyCustomizationSettings: {
        ...usePartyWorkspaceStore.getState().customizationSettings,
        groupDisplayDepth: 7,
      },
    });

    const loadedProject = projectService.deserializeProject(projectFile);

    expect(projectFile.partyCustomizationSettings?.groupDisplayDepth).toBe(7);
    expect(loadedProject.partyCustomizationSettings?.groupDisplayDepth).toBe(7);
    expect('partyGroupDisplayDepth' in projectFile).toBe(false);
  });
});
