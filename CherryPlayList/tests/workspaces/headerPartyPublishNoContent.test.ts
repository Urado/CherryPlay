import {
  hasNoPendingPartyPublishChanges,
  resolveHeaderPartyPublishDisabledReason,
} from '../../src/workspaces/party/resolveHeaderPartyPublishDisabledReason';

describe('header party publish with no publishable content', () => {
  it('only treats a linked, synced, publishable party as having no pending changes', () => {
    const input = {
      hasLinkedParty: true,
      partyLifecycleState: 'ready' as const,
      hasSyncBaseline: true,
      isOutOfSync: false,
    } as const;

    expect(hasNoPendingPartyPublishChanges(input)).toBe(true);
  });

  it('does not treat an unknown lifecycle as confirmed no-content', () => {
    const input = {
      isAuthenticated: true,
      networkEnabled: true,
      hasLinkedParty: true,
      partyLifecycleState: null,
    } as const;

    expect(
      hasNoPendingPartyPublishChanges({
        ...input,
        hasSyncBaseline: false,
        isOutOfSync: false,
      }),
    ).toBe(false);
    expect(resolveHeaderPartyPublishDisabledReason(input)).toBe('Статус вечеринки ещё не загружен');
  });

  it('keeps changed, unlinked, and non-publishable parties outside the no-pending state', () => {
    expect(
      hasNoPendingPartyPublishChanges({
        hasLinkedParty: true,
        partyLifecycleState: 'ready',
        hasSyncBaseline: true,
        isOutOfSync: true,
      }),
    ).toBe(false);
    expect(
      hasNoPendingPartyPublishChanges({
        hasLinkedParty: false,
        partyLifecycleState: 'ready',
        hasSyncBaseline: true,
        isOutOfSync: false,
      }),
    ).toBe(false);
    expect(
      hasNoPendingPartyPublishChanges({
        hasLinkedParty: true,
        partyLifecycleState: 'completed',
        hasSyncBaseline: true,
        isOutOfSync: false,
      }),
    ).toBe(false);
  });
});
