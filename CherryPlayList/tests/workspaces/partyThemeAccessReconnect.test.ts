import { resolveUnlinkedThemeAccessReconnectAction } from '../../src/workspaces/party/partyThemeAccessReconnect';

describe('resolveUnlinkedThemeAccessReconnectAction', () => {
  it('starts reconnect timer when unlinked theme load is unreachable', () => {
    expect(
      resolveUnlinkedThemeAccessReconnectAction({
        result: 'unreachable',
        hasLinkedParty: false,
      }),
    ).toBe('start');
  });

  it('clears unreachable state when unlinked theme load succeeds', () => {
    expect(
      resolveUnlinkedThemeAccessReconnectAction({
        result: 'ok',
        hasLinkedParty: false,
      }),
    ).toBe('clear');
  });

  it('does not arm unlinked reconnect when party is already linked', () => {
    expect(
      resolveUnlinkedThemeAccessReconnectAction({
        result: 'unreachable',
        hasLinkedParty: true,
      }),
    ).toBe('none');
  });

  it('returns none for unlinked failed and skipped results', () => {
    expect(
      resolveUnlinkedThemeAccessReconnectAction({
        result: 'failed',
        hasLinkedParty: false,
      }),
    ).toBe('none');
    expect(
      resolveUnlinkedThemeAccessReconnectAction({
        result: 'skipped',
        hasLinkedParty: false,
      }),
    ).toBe('none');
  });
});
