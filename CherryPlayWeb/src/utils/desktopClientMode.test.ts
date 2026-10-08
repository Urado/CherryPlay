/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DESKTOP_CLIENT_VALUE,
  isDesktopClientMode,
  isDesktopClientQueryValue,
  setDesktopClientMode,
  syncDesktopClientModeFromQuery,
} from './desktopClientMode';

describe('isDesktopClientQueryValue', () => {
  it('matches desktop case-insensitively', () => {
    expect(isDesktopClientQueryValue('desktop')).toBe(true);
    expect(isDesktopClientQueryValue('Desktop')).toBe(true);
    expect(isDesktopClientQueryValue('DESKTOP')).toBe(true);
  });

  it('rejects other values', () => {
    expect(isDesktopClientQueryValue('web')).toBe(false);
    expect(isDesktopClientQueryValue('')).toBe(false);
    expect(isDesktopClientQueryValue(null)).toBe(false);
    expect(isDesktopClientQueryValue(undefined)).toBe(false);
  });
});

describe('setDesktopClientMode / isDesktopClientMode', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('stores desktop mode in sessionStorage when enabled', () => {
    setDesktopClientMode(true);
    expect(sessionStorage.getItem('cherryplay_client_desktop')).toBe(DESKTOP_CLIENT_VALUE);
    expect(isDesktopClientMode()).toBe(true);
  });

  it('removes desktop mode from sessionStorage when disabled', () => {
    setDesktopClientMode(true);
    setDesktopClientMode(false);
    expect(sessionStorage.getItem('cherryplay_client_desktop')).toBeNull();
    expect(isDesktopClientMode()).toBe(false);
  });
});

describe('syncDesktopClientModeFromQuery', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('enables session mode for desktop query', () => {
    syncDesktopClientModeFromQuery('Desktop');
    expect(isDesktopClientMode()).toBe(true);
  });

  it('disables session mode for non-desktop query', () => {
    setDesktopClientMode(true);
    syncDesktopClientModeFromQuery('web');
    expect(isDesktopClientMode()).toBe(false);
  });

  it('disables session mode when client is null', () => {
    setDesktopClientMode(true);
    syncDesktopClientModeFromQuery(null);
    expect(isDesktopClientMode()).toBe(false);
  });
});
