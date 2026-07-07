import { renderHook } from '@testing-library/react';

import { useDemoPlayerFloatingVisibility } from '../../src/app/hooks/useDemoPlayerFloatingVisibility';
import type { Track } from '../../src/core/types/track';
import type { PlayerStatus } from '../../src/shared/stores/demoPlayerStore';

const track: Track = {
  id: 'track-1',
  name: 'Demo',
  path: 'D:/demo.flac',
  duration: 120,
};

type VisibilityParams = {
  hasDemoPlayerWorkspace: boolean;
  demoPlayerFloatingOpen: boolean;
  currentTrack: Track | null;
  demoPlayerStatus: PlayerStatus;
  setDemoPlayerFloatingOpen: jest.Mock;
};

const createParams = (overrides: Partial<VisibilityParams> = {}): VisibilityParams => ({
  hasDemoPlayerWorkspace: false,
  demoPlayerFloatingOpen: false,
  currentTrack: null,
  demoPlayerStatus: 'idle',
  setDemoPlayerFloatingOpen: jest.fn(),
  ...overrides,
});

describe('useDemoPlayerFloatingVisibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-opens floating panel when a demo session becomes active', () => {
    const setDemoPlayerFloatingOpen = jest.fn();
    const { rerender } = renderHook(
      (props: VisibilityParams) => useDemoPlayerFloatingVisibility(props),
      {
        initialProps: createParams({ setDemoPlayerFloatingOpen }),
      },
    );

    rerender(
      createParams({
        setDemoPlayerFloatingOpen,
        currentTrack: track,
        demoPlayerStatus: 'paused',
      }),
    );

    expect(setDemoPlayerFloatingOpen).toHaveBeenCalledWith(true);
  });

  it('forces floating panel closed when demo-player workspace is present', () => {
    const setDemoPlayerFloatingOpen = jest.fn();

    renderHook(() =>
      useDemoPlayerFloatingVisibility(
        createParams({
          hasDemoPlayerWorkspace: true,
          demoPlayerFloatingOpen: true,
          currentTrack: track,
          setDemoPlayerFloatingOpen,
        }),
      ),
    );

    expect(setDemoPlayerFloatingOpen).toHaveBeenCalledWith(false);
  });

  it('suppresses auto-open after manual close for the same session and track', () => {
    const setDemoPlayerFloatingOpen = jest.fn();
    const { rerender } = renderHook(
      (props: VisibilityParams) => useDemoPlayerFloatingVisibility(props),
      {
        initialProps: createParams({
          setDemoPlayerFloatingOpen,
          currentTrack: track,
          demoPlayerStatus: 'paused',
          demoPlayerFloatingOpen: true,
        }),
      },
    );

    setDemoPlayerFloatingOpen.mockClear();

    rerender(
      createParams({
        setDemoPlayerFloatingOpen,
        currentTrack: track,
        demoPlayerStatus: 'paused',
        demoPlayerFloatingOpen: false,
      }),
    );

    expect(setDemoPlayerFloatingOpen).not.toHaveBeenCalledWith(true);
  });

  it('closes floating panel when demo session ends', () => {
    const setDemoPlayerFloatingOpen = jest.fn();
    const { rerender } = renderHook(
      (props: VisibilityParams) => useDemoPlayerFloatingVisibility(props),
      {
        initialProps: createParams({
          setDemoPlayerFloatingOpen,
          currentTrack: track,
          demoPlayerStatus: 'paused',
          demoPlayerFloatingOpen: true,
        }),
      },
    );

    setDemoPlayerFloatingOpen.mockClear();

    rerender(
      createParams({
        setDemoPlayerFloatingOpen,
        currentTrack: null,
        demoPlayerStatus: 'idle',
        demoPlayerFloatingOpen: true,
      }),
    );

    expect(setDemoPlayerFloatingOpen).toHaveBeenCalledWith(false);
  });

  it('reports isFloatingVisible only when open and no demo-player workspace', () => {
    const openParams = createParams({
      currentTrack: track,
      demoPlayerStatus: 'paused',
      demoPlayerFloatingOpen: true,
    });

    const { result: openResult } = renderHook(() => useDemoPlayerFloatingVisibility(openParams));
    expect(openResult.current.isFloatingVisible).toBe(true);

    const { result: workspaceResult } = renderHook(() =>
      useDemoPlayerFloatingVisibility({
        ...openParams,
        hasDemoPlayerWorkspace: true,
      }),
    );
    expect(workspaceResult.current.isFloatingVisible).toBe(false);
  });
});
