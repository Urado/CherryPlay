import { renderHook, waitFor } from '@testing-library/react';

import { useTrackDuration } from '../../src/hooks/useTrackDuration';
import type { Track } from '../../src/types/track';
import { createTrack, flushPromises } from '../testUtils';

const createTracks = () => [
  { ...createTrack('1', '/a.mp3') },
  { ...createTrack('2', '/b.mp3') },
  { ...createTrack('3', '/c.mp3') },
];

describe('useTrackDuration', () => {
  it('loads durations in batches and resolves updates', async () => {
    const tracks = createTracks();
    const requestDuration = jest.fn(async (path: string) => {
      if (path === '/a.mp3') return 10;
      if (path === '/b.mp3') return 20;
      return 30;
    });
    const onDurationResolved = jest.fn((id: string, duration: number) => {
      const target = tracks.find((track) => track.id === id);
      if (target) {
        target.duration = duration;
      }
    });

    renderHook(() =>
      useTrackDuration({
        tracks,
        isAudioFile: (path) => path.endsWith('.mp3'),
        requestDuration,
        resolveTrackByPath: (path) => tracks.find((track) => track.path === path),
        onDurationResolved,
        batchSize: 2,
      }),
    );

    await waitFor(() => expect(onDurationResolved).toHaveBeenCalledTimes(3));
    expect(requestDuration).toHaveBeenCalledTimes(3);
  });

  it('cancels pending loads on unmount', async () => {
    const tracks = createTracks();
    let resolvePromise: ((value: number) => void) | null = null;
    const requestDuration = jest.fn(
      () =>
        new Promise<number>((resolve) => {
          resolvePromise = resolve;
        }),
    );
    const onDurationResolved = jest.fn();

    const { unmount } = renderHook(() =>
      useTrackDuration({
        tracks,
        isAudioFile: () => true,
        requestDuration,
        resolveTrackByPath: (path) => tracks.find((track) => track.path === path),
        onDurationResolved,
      }),
    );

    unmount();
    resolvePromise?.(42);
    await flushPromises();

    expect(onDurationResolved).not.toHaveBeenCalled();
  });

  it('skips invalid or already processed tracks', async () => {
    const tracks = [
      { ...createTrack('1', '/valid.mp3') },
      { ...createTrack('2', '/ignored.txt') },
      { ...createTrack('3', '/with-duration.mp3'), duration: 99 },
    ];
    const requestDuration = jest.fn(async () => 15);
    const onDurationResolved = jest.fn();

    renderHook(() =>
      useTrackDuration({
        tracks,
        isAudioFile: (path) => path.endsWith('.mp3'),
        requestDuration,
        resolveTrackByPath: (path) => tracks.find((track) => track.path === path),
        onDurationResolved,
      }),
    );

    await waitFor(() => expect(onDurationResolved).toHaveBeenCalledTimes(1));
    expect(requestDuration).toHaveBeenCalledTimes(1);
  });

  it('continues after duration request errors', async () => {
    const tracks = createTracks();
    const requestDuration = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(30);
    const onDurationResolved = jest.fn();

    renderHook(() =>
      useTrackDuration({
        tracks,
        isAudioFile: () => true,
        requestDuration,
        resolveTrackByPath: (path) => tracks.find((track) => track.path === path),
        onDurationResolved,
      }),
    );

    await waitFor(() => expect(onDurationResolved).toHaveBeenCalledTimes(2));
    expect(requestDuration).toHaveBeenCalledTimes(3);
  });

  it('requests durations for tracks added after initial render', async () => {
    const first = { ...createTrack('1', '/first.mp3') };
    const second = { ...createTrack('2', '/second.mp3') };
    let currentTracks: Track[] = [first];
    const requestDuration = jest.fn(async (path: string) => (path === '/first.mp3' ? 10 : 25));
    const onDurationResolved = jest.fn((id: string, duration: number) => {
      const target = currentTracks.find((track) => track.id === id);
      if (target) {
        target.duration = duration;
      }
    });

    const { rerender } = renderHook(
      (tracksParam: Track[]) =>
        useTrackDuration({
          tracks: tracksParam,
          isAudioFile: () => true,
          requestDuration,
          resolveTrackByPath: (path) => currentTracks.find((track) => track.path === path),
          onDurationResolved,
          batchSize: 1,
        }),
      { initialProps: currentTracks },
    );

    await waitFor(() => expect(onDurationResolved).toHaveBeenCalledWith('1', 10));

    const nextTracks: Track[] = [...currentTracks, second];
    currentTracks = nextTracks;
    rerender(nextTracks);

    await waitFor(() => expect(onDurationResolved).toHaveBeenCalledWith('2', 25));
    expect(requestDuration).toHaveBeenCalledTimes(2);
  });

  it('does not resolve durations for tracks removed before completion', async () => {
    const only = { ...createTrack('1', '/only.mp3') };
    let currentTracks: Track[] = [only];
    let resolveDuration: ((value: number) => void) | null = null;
    const requestDuration = jest.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveDuration = resolve;
        }),
    );
    const onDurationResolved = jest.fn();

    const { rerender } = renderHook(
      (tracksParam: Track[]) =>
        useTrackDuration({
          tracks: tracksParam,
          isAudioFile: () => true,
          requestDuration,
          resolveTrackByPath: (path) => currentTracks.find((track) => track.path === path),
          onDurationResolved,
        }),
      { initialProps: currentTracks },
    );

    await waitFor(() => expect(requestDuration).toHaveBeenCalledTimes(1));

    currentTracks = [];
    rerender(currentTracks);

    resolveDuration?.(42);
    await flushPromises();

    expect(onDurationResolved).not.toHaveBeenCalled();
  });

  it('skips duration requests for tracks that already have durations on rerender', async () => {
    const existing = { ...createTrack('1', '/existing.mp3') };
    let currentTracks: Track[] = [existing];
    const requestDuration = jest.fn().mockResolvedValue(12);
    const onDurationResolved = jest.fn((id: string, duration: number) => {
      const target = currentTracks.find((track) => track.id === id);
      if (target) {
        target.duration = duration;
      }
    });

    const { rerender } = renderHook(
      (tracksParam: Track[]) =>
        useTrackDuration({
          tracks: tracksParam,
          isAudioFile: () => true,
          requestDuration,
          resolveTrackByPath: (path) => currentTracks.find((track) => track.path === path),
          onDurationResolved,
        }),
      { initialProps: currentTracks },
    );

    await waitFor(() => expect(onDurationResolved).toHaveBeenCalledTimes(1));

    const nextTracks: Track[] = [{ ...existing }];
    currentTracks = nextTracks;
    rerender(nextTracks);
    await flushPromises();

    expect(requestDuration).toHaveBeenCalledTimes(1);
  });
});
