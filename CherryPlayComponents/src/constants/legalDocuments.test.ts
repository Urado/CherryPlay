import { describe, expect, it } from 'vitest';

import {
  LEGAL_COOKIES,
  LEGAL_PD_CONSENT,
  LEGAL_PRIVACY,
  LEGAL_TERMS,
  areRequiredConsentsAccepted,
  buildRequiredConsentInputs,
} from './legalDocuments';

/** SHA-256 hashes from legal-registry.generated.json (CherryPlay.LegalPublish). */
const EXPECTED_PD_CONSENT_HASH =
  '4fb5ee6b4636828a5f72c3b1091721e02c53c93160db5449e80348f24e0f84bc';
const EXPECTED_TERMS_HASH =
  '63446e6df641cb350ba24e197390c03f76ded704bfe12e692eeeb62c84e14b44';
const EXPECTED_PRIVACY_HASH =
  '57ce7ce6e9a9a82abae86b89c1a9424fac7d76c4313811b8a36416fdc6dd0ebd';
const EXPECTED_COOKIES_HASH =
  '7332f3751240a8c6431a3f5d006740ff252caf486953b7a5d3029ff1627868bc';

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
