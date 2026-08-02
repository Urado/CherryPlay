import { resolveHeaderPartyStatus } from '../../src/app/components/resolveHeaderPartyStatus';
import {
  resolvePartyLifecycleDisplayLabel,
  resolvePartyLifecycleServerBadgeLabel,
} from '../../src/workspaces/party/partyLifecycleLabels';

describe('resolvePartyLifecycleDisplayLabel', () => {
  it('returns Локально when there is no linked party', () => {
    expect(
      resolvePartyLifecycleDisplayLabel({
        linkedParty: null,
        partyLifecycleState: null,
      }),
    ).toBe('Локально');
  });

  it('returns Черновик for linked draft', () => {
    expect(
      resolvePartyLifecycleDisplayLabel({
        linkedParty: { id: 'p1', shortCode: 'abc' },
        partyLifecycleState: 'draft',
      }),
    ).toBe('Черновик');
  });

  it('returns Не начато for ready outside session', () => {
    expect(
      resolvePartyLifecycleDisplayLabel({
        linkedParty: { id: 'p1', shortCode: 'abc' },
        partyLifecycleState: 'ready',
        sessionMode: 'preparation',
      }),
    ).toBe('Не начато');
  });

  it('returns Идёт for ready in session', () => {
    expect(
      resolvePartyLifecycleDisplayLabel({
        linkedParty: { id: 'p1', shortCode: 'abc' },
        partyLifecycleState: 'ready',
        sessionMode: 'session',
      }),
    ).toBe('Идёт');
  });

  it('returns Архив for completed', () => {
    expect(
      resolvePartyLifecycleDisplayLabel({
        linkedParty: { id: 'p1', shortCode: 'abc' },
        partyLifecycleState: 'completed',
      }),
    ).toBe('Архив');
  });
});

describe('resolveHeaderPartyStatus', () => {
  it('treats linked party with null lifecycle as Черновик', () => {
    expect(
      resolveHeaderPartyStatus({
        linkedParty: { id: 'p1', shortCode: 'abc' },
        partyLifecycleState: null,
        sessionMode: 'preparation',
        serverUnreachable: false,
      }),
    ).toEqual({ primary: 'Черновик' });
  });

  it('shows нет связи as secondary when unreachable', () => {
    expect(
      resolveHeaderPartyStatus({
        linkedParty: null,
        partyLifecycleState: null,
        sessionMode: 'preparation',
        serverUnreachable: true,
      }),
    ).toEqual({ primary: 'Локально', secondary: 'нет связи' });
  });

  it('keeps primary and overlays нет связи for linked ready when unreachable', () => {
    expect(
      resolveHeaderPartyStatus({
        linkedParty: { id: 'p1', shortCode: 'abc' },
        partyLifecycleState: 'ready',
        sessionMode: 'preparation',
        serverUnreachable: true,
      }),
    ).toEqual({ primary: 'Не начато', secondary: 'нет связи' });
  });

  it('keeps primary without secondary when reachable', () => {
    expect(
      resolveHeaderPartyStatus({
        linkedParty: { id: 'p1', shortCode: 'abc' },
        partyLifecycleState: 'ready',
        sessionMode: 'session',
        serverUnreachable: false,
      }),
    ).toEqual({ primary: 'Идёт' });
  });
});

describe('resolvePartyLifecycleServerBadgeLabel', () => {
  it('maps ready to Идёт only in session', () => {
    expect(resolvePartyLifecycleServerBadgeLabel('ready')).toBe('Не начато');
    expect(resolvePartyLifecycleServerBadgeLabel('ready', 'session')).toBe('Идёт');
    expect(resolvePartyLifecycleServerBadgeLabel('draft')).toBe('Черновик');
    expect(resolvePartyLifecycleServerBadgeLabel('completed')).toBe('Архив');
  });
});
