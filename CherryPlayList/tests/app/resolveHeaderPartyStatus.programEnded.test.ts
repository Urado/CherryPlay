import {
  resolveHeaderPartyControlActiveStageIndex,
  resolveHeaderPartyControlCtaLabel,
} from '../../src/app/components/headerPartyStatusVisuals';
import { resolveHeaderPartyStatus } from '../../src/app/components/resolveHeaderPartyStatus';

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
        playbackStatus: 'paused',
        programEnded: true,
      }),
    ).toEqual({ primary: 'Конец' });
  });

  it('prefers Конец over Пауза when both paused and programEnded', () => {
    const withEnd = resolveHeaderPartyStatus({
      ...readySession,
      playbackStatus: 'paused',
      programEnded: true,
    });
    const pausedOnly = resolveHeaderPartyStatus({
      ...readySession,
      playbackStatus: 'paused',
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
        programEnded: true,
      }),
    ).toEqual({ primary: 'Ждёт начала' });
  });

  it('keeps stage 3 and К игре CTA for Конец', () => {
    expect(resolveHeaderPartyControlActiveStageIndex('Конец')).toBe(2);
    expect(resolveHeaderPartyControlCtaLabel('Конец')).toBe('К игре');
  });
});
