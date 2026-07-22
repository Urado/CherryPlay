import { act, renderHook } from '@testing-library/react';

import { useTrackItemSize } from '../../src/shared/hooks/useTrackItemSize';
import { useSettingsStore } from '../../src/shared/stores/settingsStore';
import type { TrackItemSizePreset } from '../../src/shared/types/trackItemSize';

const mockSetProperty = jest.fn();
const mockSetAttribute = jest.fn();

beforeEach(() => {
  mockSetProperty.mockClear();
  mockSetAttribute.mockClear();
  Object.defineProperty(document.documentElement.style, 'setProperty', {
    value: mockSetProperty,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'setAttribute', {
    value: mockSetAttribute,
    writable: true,
    configurable: true,
  });
});

describe('useTrackItemSize (tiny preset)', () => {
  it('sets tiny CSS variables and data-track-item-size attribute', () => {
    useSettingsStore.setState({ trackItemSizePreset: 'tiny' });
    renderHook(() => useTrackItemSize());

    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-padding', '1px');
    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-margin', '0px');
    expect(mockSetAttribute).toHaveBeenCalledWith('data-track-item-size', 'tiny');
  });

  it('falls back to medium when persisted preset is invalid', () => {
    useSettingsStore.setState({
      trackItemSizePreset: 'corrupt-value' as unknown as TrackItemSizePreset,
    });
    renderHook(() => useTrackItemSize());

    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-padding', '8px');
    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-margin', '2px');
    expect(mockSetAttribute).toHaveBeenCalledWith('data-track-item-size', 'medium');
  });

  it('updates tiny vars when preset changes to tiny', () => {
    useSettingsStore.setState({ trackItemSizePreset: 'medium' });
    const { rerender } = renderHook(() => useTrackItemSize());

    mockSetProperty.mockClear();
    mockSetAttribute.mockClear();

    act(() => {
      useSettingsStore.setState({ trackItemSizePreset: 'tiny' });
    });
    rerender();

    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-padding', '1px');
    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-margin', '0px');
    expect(mockSetAttribute).toHaveBeenCalledWith('data-track-item-size', 'tiny');
  });
});
