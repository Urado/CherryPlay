import { renderHook, act } from '@testing-library/react';

import { useSelectionWithModifiers } from '../../../src/shared/hooks/useSelectionWithModifiers';

describe('useSelectionWithModifiers', () => {
  it('extends the range from the original selection anchor across repeated Shift clicks', () => {
    const toggleSelection = jest.fn();
    const selectRange = jest.fn();
    const { result } = renderHook(() => useSelectionWithModifiers({ toggleSelection, selectRange }));

    act(() => result.current.handleToggleSelect('track-2'));
    act(() => result.current.handleToggleSelect('track-5', { shiftKey: true } as React.MouseEvent));
    act(() => result.current.handleToggleSelect('track-7', { shiftKey: true } as React.MouseEvent));

    expect(toggleSelection).toHaveBeenCalledTimes(1);
    expect(selectRange).toHaveBeenNthCalledWith(1, 'track-2', 'track-5');
    expect(selectRange).toHaveBeenNthCalledWith(2, 'track-2', 'track-7');
  });
});
