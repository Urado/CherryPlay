/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import type { ConsentInput } from './legalDocuments';
import {
  OAUTH_PENDING_CONSENTS_STORAGE_KEY,
  clearOAuthPendingConsents,
  readOAuthPendingConsents,
  stashOAuthPendingConsents,
} from './oauthPendingConsents';

describe('oauthPendingConsents', () => {
  it('round-trips valid consents and rejects malformed payload', () => {
    const consents: ConsentInput[] = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        legalDocumentVersionId: '22222222-2222-4222-8222-222222222222',
        documentHash: 'abc',
        decision: 'grant',
      },
    ];
    stashOAuthPendingConsents(consents);
    expect(readOAuthPendingConsents()).toEqual(consents);

    sessionStorage.setItem(OAUTH_PENDING_CONSENTS_STORAGE_KEY, JSON.stringify([{ id: 1 }]));
    expect(readOAuthPendingConsents()).toBeNull();

    clearOAuthPendingConsents();
    expect(sessionStorage.getItem(OAUTH_PENDING_CONSENTS_STORAGE_KEY)).toBeNull();
  });
});
