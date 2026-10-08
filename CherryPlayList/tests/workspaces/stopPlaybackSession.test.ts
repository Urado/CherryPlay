import { stopPlaybackSession } from '@workspaces/player/stopPlaybackSession';

describe('stopPlaybackSession', () => {
  it('stops locally before a server reset and publishes after success', async () => {
    const calls: string[] = [];

    await stopPlaybackSession({
      shouldResetServer: true,
      stopLocally: () => calls.push('local-stop'),
      resetServerPlaybackState: () => {
        calls.push('server-reset');
        return Promise.resolve();
      },
      publishFullState: () => calls.push('publish'),
      onServerResetFailure: () => calls.push('failure'),
    });

    expect(calls).toEqual(['local-stop', 'server-reset', 'publish']);
  });

  it('keeps the local stop when the server reset fails', async () => {
    const error = new Error('server unavailable');
    const calls: string[] = [];

    await stopPlaybackSession({
      shouldResetServer: true,
      stopLocally: () => calls.push('local-stop'),
      resetServerPlaybackState: () => {
        calls.push('server-reset');
        return Promise.reject(error);
      },
      publishFullState: () => calls.push('publish'),
      onServerResetFailure: (failure) => {
        calls.push(failure === error ? 'failure' : 'unexpected-failure');
      },
    });

    expect(calls).toEqual(['local-stop', 'server-reset', 'failure']);
  });

  it('stops locally without requesting a server reset when streaming is disabled', async () => {
    const stopLocally = jest.fn();
    const resetServerPlaybackState = jest.fn();
    const publishFullState = jest.fn();
    const onServerResetFailure = jest.fn();

    await stopPlaybackSession({
      shouldResetServer: false,
      stopLocally,
      resetServerPlaybackState,
      publishFullState,
      onServerResetFailure,
    });

    expect(stopLocally).toHaveBeenCalledTimes(1);
    expect(resetServerPlaybackState).not.toHaveBeenCalled();
    expect(publishFullState).not.toHaveBeenCalled();
    expect(onServerResetFailure).not.toHaveBeenCalled();
  });
});
