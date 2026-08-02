import { describe, expect, it } from 'vitest';

import { DEFAULT_PARTY_THEME_ID, getPartyThemeOrDefault } from './index';

describe('DEFAULT_PARTY_THEME_ID', () => {
  it('is basic', () => {
    expect(DEFAULT_PARTY_THEME_ID).toBe('basic');
  });

  it('is the theme returned by getPartyThemeOrDefault for null', () => {
    expect(getPartyThemeOrDefault(null).id).toBe(DEFAULT_PARTY_THEME_ID);
  });
});
