import { describe, expect, it } from 'vitest';

import {
  isPartyDisplayStatusId,
  partyViewerStatusFromId,
  PARTY_DISPLAY_STATUS_IDS,
} from './partyViewerStatus';

describe('isPartyDisplayStatusId', () => {
  it.each(PARTY_DISPLAY_STATUS_IDS)('accepts %s', (id) => {
    expect(isPartyDisplayStatusId(id)).toBe(true);
  });

  it('rejects unknown strings', () => {
    expect(isPartyDisplayStatusId('program_ended')).toBe(false);
    expect(isPartyDisplayStatusId('')).toBe(false);
    expect(isPartyDisplayStatusId(null)).toBe(false);
  });
});

describe('partyViewerStatusFromId', () => {
  it('returns label and ariaLabel for live', () => {
    const status = partyViewerStatusFromId('live');

    expect(status).toEqual({
      id: 'live',
      label: 'Вечеринка идёт',
      ariaLabel: 'Вечеринка идёт',
    });
  });
});
