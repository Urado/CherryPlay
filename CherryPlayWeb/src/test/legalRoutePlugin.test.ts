import { describe, expect, it } from 'vitest';

import { rewriteLegalRouteRequest } from '../../vitePlugins/legalRoutePlugin';

describe('legal route dev middleware', () => {
  it('rewrites the legal directory path to the SPA entry', () => {
    expect(rewriteLegalRouteRequest('/legal')).toBe('/index.html');
    expect(rewriteLegalRouteRequest('/legal/')).toBe('/index.html');
    expect(rewriteLegalRouteRequest('/legal?source=settings')).toBe(
      '/index.html?source=settings',
    );
  });

  it('leaves unrelated public paths untouched', () => {
    expect(rewriteLegalRouteRequest('/legal/v1.0/privacy.md')).toBe(
      '/legal/v1.0/privacy.md',
    );
    expect(rewriteLegalRouteRequest('/legal-other')).toBe('/legal-other');
    expect(rewriteLegalRouteRequest(undefined)).toBeUndefined();
  });

  it('does not rewrite non-page requests', () => {
    expect(rewriteLegalRouteRequest('/legal', 'POST')).toBe('/legal');
  });
});
