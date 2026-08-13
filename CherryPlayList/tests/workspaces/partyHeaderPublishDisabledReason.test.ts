import { resolveHeaderPartyPublishDisabledReason } from '../../src/workspaces/party/resolveHeaderPartyPublishDisabledReason';

describe('resolveHeaderPartyPublishDisabledReason', () => {
  it('requires online, auth, and linked party', () => {
    expect(
      resolveHeaderPartyPublishDisabledReason({
        isAuthenticated: true,
        networkEnabled: false,
        hasLinkedParty: true,
        partyLifecycleState: 'ready',
      }),
    ).toMatch(/Онлайн/);

    expect(
      resolveHeaderPartyPublishDisabledReason({
        isAuthenticated: false,
        networkEnabled: true,
        hasLinkedParty: true,
        partyLifecycleState: 'ready',
      }),
    ).toMatch(/войти/);

    expect(
      resolveHeaderPartyPublishDisabledReason({
        isAuthenticated: true,
        networkEnabled: true,
        hasLinkedParty: false,
        partyLifecycleState: null,
      }),
    ).toMatch(/создайте|привяжите/i);
  });

  it('allows publish for ready and draft linked parties', () => {
    expect(
      resolveHeaderPartyPublishDisabledReason({
        isAuthenticated: true,
        networkEnabled: true,
        hasLinkedParty: true,
        partyLifecycleState: 'ready',
      }),
    ).toBeNull();

    expect(
      resolveHeaderPartyPublishDisabledReason({
        isAuthenticated: true,
        networkEnabled: true,
        hasLinkedParty: true,
        partyLifecycleState: 'draft',
      }),
    ).toBeNull();
  });
});
