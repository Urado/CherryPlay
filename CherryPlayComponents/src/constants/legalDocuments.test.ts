import { describe, expect, it } from 'vitest';

import {
  LEGAL_COOKIES,
  LEGAL_PD_CONSENT,
  LEGAL_PRIVACY,
  LEGAL_TERMS,
  areRequiredConsentsAccepted,
  buildRequiredConsentInputs,
} from './legalDocuments';

const EXPECTED_PD_CONSENT_HASH =
  '2cdeb1176caf020a42e92e302f016d8dbe4a81dc89838218b92ce655bb6d14a3';
const EXPECTED_TERMS_HASH =
  '6dffebc1d8cbd1b32d0f21ae2b438a58917e52c06612255049e6f00174c6d399';
const EXPECTED_PRIVACY_HASH =
  '1cf23d3e1f2e245962520306bd5cb5b0c0e0b6ab32631c47866cc50f611fe49d';
const EXPECTED_COOKIES_HASH =
  'b83b193ee6d38cf862e66aec8c8c50c049d31b5e31751deef4b2c101866938e7';

describe('legalDocuments', () => {
  it('loads deploy config hashes/versionIds from generated registry', () => {
    expect(LEGAL_PD_CONSENT).toMatchObject({
      type: 'pd_consent_text',
      versionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      documentVersion: '1.0',
      contentHash: EXPECTED_PD_CONSENT_HASH,
      currentPath: '/consent',
      archivePath: '/consent/v/1.0',
    });
    expect(LEGAL_TERMS).toMatchObject({
      type: 'terms',
      versionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      contentHash: EXPECTED_TERMS_HASH,
      currentPath: '/terms',
    });
    expect(LEGAL_PRIVACY.contentHash).toBe(EXPECTED_PRIVACY_HASH);
    expect(LEGAL_COOKIES.contentHash).toBe(EXPECTED_COOKIES_HASH);
    expect(LEGAL_PD_CONSENT.checkboxLabel).toBeTruthy();
    expect(LEGAL_PD_CONSENT.summary).toBeTruthy();
  });

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
      documentHash: EXPECTED_PD_CONSENT_HASH,
      decision: 'grant',
    });
    expect(consents[1]).toEqual({
      id: 'id-2',
      legalDocumentVersionId: LEGAL_TERMS.versionId,
      documentHash: EXPECTED_TERMS_HASH,
      decision: 'grant',
    });
  });
});
