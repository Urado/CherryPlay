import {
  resolveHeaderPartyControlActiveStageIndex,
  resolveHeaderPartyControlCtaLabel,
} from '../../src/app/components/headerPartyStatusVisuals';
import { resolveHeaderPartyStatus } from '../../src/app/components/resolveHeaderPartyStatus';
import { createInitialAimpBridgeState } from '../../src/shared/contracts/aimp';
import { resolvePartyPlaybackSourceState } from '../../src/workspaces/party/partyPlaybackSource';

const cherryPlayPlaybackSourceState = (
  sessionMode: 'preparation' | 'session',
  status: 'playing' | 'paused' = 'playing',
) =>
  resolvePartyPlaybackSourceState('cherryPlayPlayer', {
    sessionMode,
    playerPlaybackStatus: status,
    aimpBridgeState: createInitialAimpBridgeState(),
  });

describe('resolveHeaderPartyStatus programEnded overlay', () => {
  const readySession = {
    linkedParty: { id: 'p1', shortCode: 'abc' },
    partyLifecycleState: 'ready' as const,
    sessionMode: 'session' as const,
    serverUnreachable: false,
  };

  it('overlays Конец over Идёт when programEnded', () => {
    expect(
      resolveHeaderPartyStatus({
        ...readySession,
        playbackSourceState: cherryPlayPlaybackSourceState('session', 'paused'),
        programEnded: true,
      }),
    ).toEqual({ primary: 'Конец' });
  });

  it('prefers Конец over Пауза when both paused and programEnded', () => {
    const withEnd = resolveHeaderPartyStatus({
      ...readySession,
      playbackSourceState: cherryPlayPlaybackSourceState('session', 'paused'),
      programEnded: true,
    });
    const pausedOnly = resolveHeaderPartyStatus({
      ...readySession,
      playbackSourceState: cherryPlayPlaybackSourceState('session', 'paused'),
      programEnded: false,
    });
    expect(withEnd.primary).toBe('Конец');
    expect(pausedOnly.primary).toBe('Пауза');
  });

  it('does not overlay Конец outside Идёт base status', () => {
    expect(
      resolveHeaderPartyStatus({
        linkedParty: { id: 'p1', shortCode: 'abc' },
        partyLifecycleState: 'ready',
        sessionMode: 'preparation',
        serverUnreachable: false,
        playbackSourceState: cherryPlayPlaybackSourceState('preparation'),
        programEnded: true,
      }),
    ).toEqual({ primary: 'Ждёт начала' });
  });

  it('keeps stage 3 and Играть CTA for Конец', () => {
    expect(resolveHeaderPartyControlActiveStageIndex('Конец')).toBe(2);
    expect(resolveHeaderPartyControlCtaLabel('Конец')).toBe('Играть');
  });
});
