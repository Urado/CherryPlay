import { describe, expect, it } from 'vitest';

import {
  LEGAL_COOKIES,
  LEGAL_PD_CONSENT,
  LEGAL_PRIVACY,
  LEGAL_TERMS,
  areRequiredConsentsAccepted,
  buildRequiredConsentInputs,
} from './legalDocuments';

const EXPECTED_PD_CONSENT_HASH = '1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f';
const EXPECTED_TERMS_HASH = 'c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d';
const EXPECTED_PRIVACY_HASH = '284f16561a4144c980a30d1dae93a86e59155cbd8c41edd9372b3002fae03439';
const EXPECTED_COOKIES_HASH = '27746265179e4bfcdbf54cfd0413045563bf44725b7a22c46115f8d49a8a7904';

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
