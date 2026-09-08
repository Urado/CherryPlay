import { describe, expect, it } from 'vitest';

import {
  LEGAL_PD_CONSENT,
  LEGAL_TERMS,
  areRequiredConsentsAccepted,
  buildRequiredConsentInputs,
} from './legalDocuments';

describe('legalDocuments', () => {
  it('areRequiredConsentsAccepted requires both checkboxes', () => {
    expect(areRequiredConsentsAccepted(false, false)).toBe(false);
    expect(areRequiredConsentsAccepted(true, false)).toBe(false);
    expect(areRequiredConsentsAccepted(false, true)).toBe(false);
    expect(areRequiredConsentsAccepted(true, true)).toBe(true);
  });

  it('buildRequiredConsentInputs emits grants for pd + terms seed versions', () => {
    let n = 0;
    const consents = buildRequiredConsentInputs(() => `id-${++n}`);

    expect(consents).toHaveLength(2);
    expect(consents[0]).toEqual({
      id: 'id-1',
      legalDocumentVersionId: LEGAL_PD_CONSENT.versionId,
      documentHash: LEGAL_PD_CONSENT.contentHash,
      decision: 'grant',
    });
    expect(consents[1]).toEqual({
      id: 'id-2',
      legalDocumentVersionId: LEGAL_TERMS.versionId,
      documentHash: LEGAL_TERMS.contentHash,
      decision: 'grant',
    });
  });
});
