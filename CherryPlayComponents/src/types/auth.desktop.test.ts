import { describe, expect, it } from 'vitest';

import {
  DESKTOP_AUTH_DEEP_LINK_BASE,
  buildAuthReturnUrl,
  buildDesktopAuthDeepLink,
  isAllowedAuthReturnTo,
  resolveDesktopAuthReturnTo,
} from './auth';

describe('buildAuthReturnUrl', () => {
  it('joins with ? when base has no query', () => {
    expect(buildAuthReturnUrl('cherryplaylist://auth', 'abc')).toBe(
      'cherryplaylist://auth?code=abc',
    );
  });

  it('joins with & when base already has a query', () => {
    expect(buildAuthReturnUrl('http://localhost:5173/auth/callback?x=1', 'abc')).toBe(
      'http://localhost:5173/auth/callback?x=1&code=abc',
    );
  });

  it('encodes the code value', () => {
    expect(buildAuthReturnUrl('cherryplaylist://auth', 'a b/c')).toBe(
      'cherryplaylist://auth?code=a%20b%2Fc',
    );
  });

  it('trims the returnTo base', () => {
    expect(buildAuthReturnUrl('  cherryplaylist://auth  ', 'x')).toBe(
      'cherryplaylist://auth?code=x',
    );
  });
});

describe('buildDesktopAuthDeepLink', () => {
  it('builds deep link from DESKTOP_AUTH_DEEP_LINK_BASE', () => {
    expect(buildDesktopAuthDeepLink('token-1')).toBe(`${DESKTOP_AUTH_DEEP_LINK_BASE}?code=token-1`);
  });
});

describe('isAllowedAuthReturnTo', () => {
  it('rejects empty, null, and whitespace', () => {
    expect(isAllowedAuthReturnTo(null)).toBe(false);
    expect(isAllowedAuthReturnTo(undefined)).toBe(false);
    expect(isAllowedAuthReturnTo('')).toBe(false);
    expect(isAllowedAuthReturnTo('   ')).toBe(false);
  });

  it('allows deep-link base and prefixes', () => {
    expect(isAllowedAuthReturnTo(DESKTOP_AUTH_DEEP_LINK_BASE)).toBe(true);
    expect(isAllowedAuthReturnTo(`${DESKTOP_AUTH_DEEP_LINK_BASE}?foo=1`)).toBe(true);
  });

  it('allows localhost http callback on ports 5173 and 5174', () => {
    expect(isAllowedAuthReturnTo('http://localhost:5173/auth/callback')).toBe(true);
    expect(isAllowedAuthReturnTo('http://127.0.0.1:5174/auth/callback')).toBe(true);
  });

  it('rejects disallowed hosts, paths, ports, and protocols', () => {
    expect(isAllowedAuthReturnTo('https://localhost:5173/auth/callback')).toBe(false);
    expect(isAllowedAuthReturnTo('http://localhost:5173/other')).toBe(false);
    expect(isAllowedAuthReturnTo('http://localhost:3000/auth/callback')).toBe(false);
    expect(isAllowedAuthReturnTo('http://example.com:5173/auth/callback')).toBe(false);
    expect(isAllowedAuthReturnTo('not a url')).toBe(false);
  });
});

describe('resolveDesktopAuthReturnTo', () => {
  it('returns trimmed allowlisted value', () => {
    expect(resolveDesktopAuthReturnTo('  http://localhost:5173/auth/callback  ')).toBe(
      'http://localhost:5173/auth/callback',
    );
  });

  it('falls back to DESKTOP_AUTH_DEEP_LINK_BASE', () => {
    expect(resolveDesktopAuthReturnTo(null)).toBe(DESKTOP_AUTH_DEEP_LINK_BASE);
    expect(resolveDesktopAuthReturnTo('https://evil.example/')).toBe(DESKTOP_AUTH_DEEP_LINK_BASE);
  });
});
