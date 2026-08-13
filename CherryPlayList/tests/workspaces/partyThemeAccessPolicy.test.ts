import type { ThemeAccessDto } from '@shared/services/partyService';

import { shouldShowThemeAccessLoading } from '../../src/workspaces/party/partyThemeAccessLoad';
import {
  resolveCreateBlockedByTheme,
  resolveThemeAccessAfterFetchFailure,
  resolveThemePickerHintMessage,
  THEME_PICKER_ONLINE_OFF_MESSAGE,
  THEME_PICKER_UNAVAILABLE_MESSAGE,
} from '../../src/workspaces/party/partyWorkspaceUtils';

const sampleAccess: ThemeAccessDto = {
  grantedThemeIds: ['basic'],
  visibleLockedThemes: [],
  contactUrl: '',
};

describe('resolveCreateBlockedByTheme', () => {
  it('blocks only when themeAccess exists and current theme is locked', () => {
    expect(
      resolveCreateBlockedByTheme({
        themeAccess: null,
        isCurrentThemeLocked: true,
      }),
    ).toEqual({ blocked: false, title: undefined });

    expect(
      resolveCreateBlockedByTheme({
        themeAccess: sampleAccess,
        isCurrentThemeLocked: false,
      }),
    ).toEqual({ blocked: false, title: undefined });

    expect(
      resolveCreateBlockedByTheme({
        themeAccess: sampleAccess,
        isCurrentThemeLocked: true,
      }),
    ).toEqual({
      blocked: true,
      title: 'Выберите тему, доступную в вашем тарифе',
    });
  });
});

describe('resolveThemeAccessAfterFetchFailure', () => {
  it('keeps cached entitlement and clears picker error', () => {
    expect(resolveThemeAccessAfterFetchFailure(sampleAccess)).toEqual({
      themeAccess: sampleAccess,
      themeAccessErrorMessage: null,
    });
  });

  it('sets picker unavailable message when there is no cache', () => {
    expect(resolveThemeAccessAfterFetchFailure(null)).toEqual({
      themeAccess: null,
      themeAccessErrorMessage: THEME_PICKER_UNAVAILABLE_MESSAGE,
    });
  });
});

describe('shouldShowThemeAccessLoading', () => {
  it('shows loading only when themeAccess is not cached', () => {
    expect(shouldShowThemeAccessLoading(null)).toBe(true);
    expect(shouldShowThemeAccessLoading(sampleAccess)).toBe(false);
  });
});

describe('resolveThemePickerHintMessage', () => {
  it('uses online-off copy when network is disabled', () => {
    expect(
      resolveThemePickerHintMessage({
        networkEnabled: false,
        hasThemeAccess: false,
        isThemeAccessLoading: false,
        themeAccessErrorMessage: THEME_PICKER_UNAVAILABLE_MESSAGE,
      }),
    ).toBe(THEME_PICKER_ONLINE_OFF_MESSAGE);
  });

  it('uses server-unreachable copy when online without cache', () => {
    expect(
      resolveThemePickerHintMessage({
        networkEnabled: true,
        hasThemeAccess: false,
        isThemeAccessLoading: false,
        themeAccessErrorMessage: null,
      }),
    ).toBe(THEME_PICKER_UNAVAILABLE_MESSAGE);
  });

  it('hides hint while loading or when access is available', () => {
    expect(
      resolveThemePickerHintMessage({
        networkEnabled: true,
        hasThemeAccess: false,
        isThemeAccessLoading: true,
        themeAccessErrorMessage: null,
      }),
    ).toBeNull();

    expect(
      resolveThemePickerHintMessage({
        networkEnabled: true,
        hasThemeAccess: true,
        isThemeAccessLoading: false,
        themeAccessErrorMessage: null,
      }),
    ).toBeNull();
  });
});
