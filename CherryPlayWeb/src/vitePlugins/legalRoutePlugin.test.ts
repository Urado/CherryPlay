import { describe, expect, it } from 'vitest';

import { rewriteLegalRouteRequest } from '../../vitePlugins/legalRoutePlugin';

describe('rewriteLegalRouteRequest', () => {
  it('routes the legal operator path to the SPA entry without a directory redirect', () => {
    expect(rewriteLegalRouteRequest('/legal')).toBe('/index.html');
    expect(rewriteLegalRouteRequest('/legal?source=desktop')).toBe('/index.html?source=desktop');
    expect(rewriteLegalRouteRequest('/legal/')).toBe('/index.html');
  });

  it('leaves other routes and legal archive paths unchanged', () => {
    expect(rewriteLegalRouteRequest('/privacy')).toBe('/privacy');
    expect(rewriteLegalRouteRequest('/legal/v/1.0')).toBe('/legal/v/1.0');
    expect(rewriteLegalRouteRequest(undefined)).toBeUndefined();
  });
});
