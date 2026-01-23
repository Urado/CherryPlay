import { act, renderHook } from '@testing-library/react';

import { useTrackItemSize } from '../../src/hooks/useTrackItemSize';
import { useSettingsStore } from '../../src/state/settingsStore';

// Mock document.documentElement.style.setProperty
const mockSetProperty = jest.fn();

beforeEach(() => {
  mockSetProperty.mockClear();
  Object.defineProperty(document.documentElement.style, 'setProperty', {
    value: mockSetProperty,
    writable: true,
    configurable: true,
  });
});

describe('useTrackItemSize', () => {
  it('should set CSS variables for medium preset by default', () => {
    useSettingsStore.setState({ trackItemSizePreset: 'medium' });
    renderHook(() => useTrackItemSize());

    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-padding', '12px');
    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-margin', '4px');
  });

  it('should set CSS variables for small preset', () => {
    useSettingsStore.setState({ trackItemSizePreset: 'small' });
    renderHook(() => useTrackItemSize());

    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-padding', '8px');
    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-margin', '2px');
  });

  it('should set CSS variables for large preset', () => {
    useSettingsStore.setState({ trackItemSizePreset: 'large' });
    renderHook(() => useTrackItemSize());

    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-padding', '16px');
    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-margin', '6px');
  });

  it('should update CSS variables when preset changes', () => {
    useSettingsStore.setState({ trackItemSizePreset: 'medium' });
    const { rerender } = renderHook(() => useTrackItemSize());

    mockSetProperty.mockClear();

    act(() => {
      useSettingsStore.setState({ trackItemSizePreset: 'small' });
    });
    rerender();

    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-padding', '8px');
    expect(mockSetProperty).toHaveBeenCalledWith('--track-item-margin', '2px');
  });
});
