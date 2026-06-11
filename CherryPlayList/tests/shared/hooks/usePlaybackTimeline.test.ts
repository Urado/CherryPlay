import { act, renderHook } from '@testing-library/react';

import { usePlaybackTimeline } from '../../../src/shared/hooks/usePlaybackTimeline';

describe('usePlaybackTimeline', () => {
  it('uses engine position when not scrubbing', () => {
    const seek = jest.fn();
    const { result } = renderHook(() =>
      usePlaybackTimeline({
        position: 42,
        duration: 200,
        disabled: false,
        seek,
      }),
    );

    expect(result.current.displayPosition).toBe(42);
    expect(result.current.resolvedDuration).toBe(200);
  });

  it('keeps local scrub value while scrubbing', () => {
    const seek = jest.fn();
    const { result } = renderHook(() =>
      usePlaybackTimeline({
        position: 10,
        duration: 100,
        disabled: false,
        seek,
      }),
    );

    act(() => {
      result.current.beginScrub();
    });

    act(() => {
      result.current.handleInput({
        target: { value: '55' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.displayPosition).toBe(55);
    expect(seek).toHaveBeenCalledWith(55);
  });

  it('ends scrubbing on change and calls onSeekCommitted', () => {
    const seek = jest.fn();
    const onSeekCommitted = jest.fn();
    const { result } = renderHook(() =>
      usePlaybackTimeline({
        position: 10,
        duration: 100,
        disabled: false,
        seek,
        onSeekCommitted,
      }),
    );

    act(() => {
      result.current.beginScrub();
      result.current.handleChange({
        target: { value: '70' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(seek).toHaveBeenCalledWith(70);
    expect(onSeekCommitted).toHaveBeenCalledWith(70);
    expect(result.current.displayPosition).toBe(10);
  });
});
