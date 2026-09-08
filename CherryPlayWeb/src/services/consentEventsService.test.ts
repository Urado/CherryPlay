import { LEGAL_PD_CONSENT, LEGAL_TERMS } from '@cherryplay/components';
import { describe, expect, it } from 'vitest';

import {
  buildConsentInputsForMissing,
  computeMissingRequiredVersionIds,
  ConsentDocumentsOutdatedError,
  type ConsentEventDto,
} from './consentEventsService';

describe('consentEventsService helpers', () => {
  it('computeMissingRequiredVersionIds reports both when empty', () => {
    expect(computeMissingRequiredVersionIds([])).toEqual([
      LEGAL_PD_CONSENT.versionId,
      LEGAL_TERMS.versionId,
    ]);
  });

  it('computeMissingRequiredVersionIds ignores non-grant latest', () => {
    const events: ConsentEventDto[] = [
      {
        id: '1',
        legalDocumentVersionId: LEGAL_PD_CONSENT.versionId,
        documentHash: LEGAL_PD_CONSENT.contentHash,
        decision: 'withdraw',
        eventAt: '2026-09-02T00:00:00Z',
      },
      {
        id: '2',
        legalDocumentVersionId: LEGAL_TERMS.versionId,
        documentHash: LEGAL_TERMS.contentHash,
        decision: 'grant',
        eventAt: '2026-09-02T00:00:00Z',
      },
    ];

    expect(computeMissingRequiredVersionIds(events)).toEqual([LEGAL_PD_CONSENT.versionId]);
  });

  it('buildConsentInputsForMissing filters by missing version ids', () => {
    const inputs = buildConsentInputsForMissing([LEGAL_TERMS.versionId], () => 'fixed-id');
    expect(inputs).toEqual([
      {
        id: 'fixed-id',
        legalDocumentVersionId: LEGAL_TERMS.versionId,
        documentHash: LEGAL_TERMS.contentHash,
        decision: 'grant',
      },
    ]);
  });

  it('buildConsentInputsForMissing uses all required when missing omitted', () => {
    const inputs = buildConsentInputsForMissing(undefined, () => 'fixed-id');
    expect(inputs).toHaveLength(2);
    expect(inputs.map((item) => item.legalDocumentVersionId)).toEqual([
      LEGAL_PD_CONSENT.versionId,
      LEGAL_TERMS.versionId,
    ]);
  });

  it('buildConsentInputsForMissing throws when missing has no client intersection', () => {
    expect(() =>
      buildConsentInputsForMissing(['ffffffff-ffff-ffff-ffff-ffffffffffff'], () => 'x'),
    ).toThrow(ConsentDocumentsOutdatedError);
  });

  it('buildConsentInputsForMissing throws on empty missing array', () => {
    expect(() => buildConsentInputsForMissing([], () => 'x')).toThrow(
      ConsentDocumentsOutdatedError,
    );
  });
});
