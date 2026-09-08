import { describe, expect, it } from 'vitest';

import { isAuthError } from './apiErrorHandler';

describe('isAuthError', () => {
  it('treats 401 as logout-worthy auth error', () => {
    expect(isAuthError(401)).toBe(true);
    expect(isAuthError(401, 'anything')).toBe(true);
  });

  it('treats generic 403 as logout-worthy auth error', () => {
    expect(isAuthError(403)).toBe(true);
    expect(isAuthError(403, 'forbidden')).toBe(true);
    expect(isAuthError(403, 'theme_not_entitled')).toBe(true);
  });

  it('does not treat 403 consent_required as logout-worthy (gate via apiFetch)', () => {
    expect(isAuthError(403, 'consent_required')).toBe(false);
  });

  it('ignores other statuses', () => {
    expect(isAuthError(400)).toBe(false);
    expect(isAuthError(404)).toBe(false);
    expect(isAuthError(500)).toBe(false);
  });
});
