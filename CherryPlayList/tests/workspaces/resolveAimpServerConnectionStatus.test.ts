import { resolveAimpServerConnectionStatus } from '../../src/workspaces/aimp/resolveAimpServerConnectionStatus';

describe('resolveAimpServerConnectionStatus', () => {
  it('shows a disconnected state after logout even if the publishing path was ready', () => {
    expect(
      resolveAimpServerConnectionStatus({
        isAuthenticated: false,
        enableStreaming: true,
        linkedPartyId: 'party-1',
        publishingPathStatus: 'ready',
      }),
    ).toEqual({ name: 'Сервер', label: 'Войдите в аккаунт', state: 'disconnected' });
  });

  it('shows the server as connected for an authenticated organizer with a ready path', () => {
    expect(
      resolveAimpServerConnectionStatus({
        isAuthenticated: true,
        enableStreaming: true,
        linkedPartyId: 'party-1',
        publishingPathStatus: 'ready',
      }),
    ).toEqual({ name: 'Сервер', label: 'На связи', state: 'connected' });
  });
});
