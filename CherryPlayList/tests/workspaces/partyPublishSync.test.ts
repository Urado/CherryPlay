import {
  buildPartyPublishMetadataSignature,
  resolveHeaderPartyPublishHighlight,
  type PartyPublishSyncParts,
} from '../../src/workspaces/party/partyPublishSync';

const synced: PartyPublishSyncParts = {
  playlist: 'playlist-a',
  metadata: 'metadata-a',
};

describe('resolveHeaderPartyPublishHighlight', () => {
  it('is off without linked party or when publish is not applicable', () => {
    expect(
      resolveHeaderPartyPublishHighlight({
        hasLinkedParty: false,
        partyLifecycleState: 'ready',
        lastSynced: synced,
        current: { playlist: 'other', metadata: 'metadata-a' },
      }),
    ).toBe(false);

    expect(
      resolveHeaderPartyPublishHighlight({
        hasLinkedParty: true,
        partyLifecycleState: 'completed',
        lastSynced: synced,
        current: { playlist: 'other', metadata: 'metadata-a' },
      }),
    ).toBe(false);

    expect(
      resolveHeaderPartyPublishHighlight({
        hasLinkedParty: true,
        partyLifecycleState: 'ready',
        lastSynced: null,
        current: { playlist: 'other', metadata: 'metadata-a' },
      }),
    ).toBe(false);
  });

  it('is on when playlist or metadata differs from last synced', () => {
    expect(
      resolveHeaderPartyPublishHighlight({
        hasLinkedParty: true,
        partyLifecycleState: 'ready',
        lastSynced: synced,
        current: { playlist: 'playlist-b', metadata: 'metadata-a' },
      }),
    ).toBe(true);

    expect(
      resolveHeaderPartyPublishHighlight({
        hasLinkedParty: true,
        partyLifecycleState: 'draft',
        lastSynced: synced,
        current: { playlist: 'playlist-a', metadata: 'metadata-b' },
      }),
    ).toBe(true);
  });

  it('is off when current matches last synced', () => {
    expect(
      resolveHeaderPartyPublishHighlight({
        hasLinkedParty: true,
        partyLifecycleState: 'ready',
        lastSynced: synced,
        current: synced,
      }),
    ).toBe(false);
  });
});

describe('buildPartyPublishMetadataSignature', () => {
  it('changes when a publishable field changes', () => {
    const base = {
      partyName: 'Party',
      partyTitle: 'Title',
      partySubtitle: '',
      themeId: 'basic' as const,
      customizationSettings: {},
      eventDateTime: '',
      eventEndDateTime: '',
      description: '',
      place: '',
      city: '',
      schedule: '',
      timeZone: '',
      shortDescription: '',
      externalLinkUrl: '',
      externalLinkText: '',
      danceTags: [] as string[],
      isListedInCatalog: false,
    };

    const before = buildPartyPublishMetadataSignature(base);
    const after = buildPartyPublishMetadataSignature({ ...base, partyName: 'Other' });
    expect(before).not.toBe(after);
  });
});
