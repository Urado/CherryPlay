import { runNewProjectWithSessionGuard } from '../../../src/shared/utils/newProjectSessionGuard';

describe('runNewProjectWithSessionGuard', () => {
  it('leaves the project, session, and playback unchanged when session stop is canceled', async () => {
    const calls: string[] = [];

    const result = await runNewProjectWithSessionGuard({
      sessionActive: true,
      confirmSessionStop: () => {
        calls.push('confirm');
        return false;
      },
      stopLocally: () => calls.push('local-stop'),
      stopServerSession: () => {
        calls.push('server-stop');
        return Promise.resolve();
      },
      resetProject: () => calls.push('new-project'),
      onServerStopFailure: () => calls.push('server-failure'),
    });

    expect(result).toBe(false);
    expect(calls).toEqual(['confirm']);
  });

  it('stops playback and the server session before resetting the project when confirmed', async () => {
    const calls: string[] = [];

    const result = await runNewProjectWithSessionGuard({
      sessionActive: true,
      confirmSessionStop: () => true,
      stopLocally: () => calls.push('local-stop'),
      stopServerSession: () => {
        calls.push('server-stop');
        return Promise.resolve();
      },
      resetProject: () => calls.push('new-project'),
      onServerStopFailure: () => calls.push('server-failure'),
    });

    expect(result).toBe(true);
    expect(calls).toEqual(['local-stop', 'server-stop', 'new-project']);
  });

  it('keeps the session and linked party when the server stop fails', async () => {
    const serverError = new Error('server unavailable');
    const session = { mode: 'session', linkedPartyId: 'party-1' };
    const calls: string[] = [];

    const result = await runNewProjectWithSessionGuard({
      sessionActive: true,
      confirmSessionStop: () => true,
      stopLocally: () => calls.push('local-stop'),
      stopServerSession: () => {
        calls.push('server-stop');
        return Promise.reject(serverError);
      },
      resetProject: () => {
        calls.push('new-project');
        session.mode = 'preparation';
        session.linkedPartyId = '';
      },
      onServerStopFailure: (error) => {
        calls.push(error === serverError ? 'server-failure' : 'unexpected-failure');
      },
    });

    expect(result).toBe(false);
    expect(calls).toEqual(['local-stop', 'server-stop', 'server-failure']);
    expect(session).toEqual({ mode: 'session', linkedPartyId: 'party-1' });
  });

  it('creates a new project without asking to stop an inactive session', async () => {
    const calls: string[] = [];

    const result = await runNewProjectWithSessionGuard({
      sessionActive: false,
      confirmSessionStop: () => {
        calls.push('confirm');
        return false;
      },
      stopLocally: () => calls.push('local-stop'),
      stopServerSession: () => {
        calls.push('server-stop');
        return Promise.resolve();
      },
      resetProject: () => calls.push('new-project'),
      onServerStopFailure: () => calls.push('server-failure'),
    });

    expect(result).toBe(true);
    expect(calls).toEqual(['new-project']);
  });
});
