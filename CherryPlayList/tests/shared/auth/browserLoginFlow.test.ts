import {
  beginBrowserLoginFlow,
  completeBrowserLoginFlow,
  failBrowserLoginFlow,
  getBrowserLoginFlowState,
  resetBrowserLoginFlow,
  subscribeBrowserLoginFlow,
} from '@shared/auth/browserLoginFlow';

describe('browserLoginFlow', () => {
  beforeEach(() => {
    resetBrowserLoginFlow();
  });

  afterEach(() => {
    resetBrowserLoginFlow();
  });

  it('begin → waiting', () => {
    beginBrowserLoginFlow();
    expect(getBrowserLoginFlowState()).toEqual({ status: 'waiting', error: null });
  });

  it('complete → idle', () => {
    beginBrowserLoginFlow();
    completeBrowserLoginFlow();
    expect(getBrowserLoginFlowState()).toEqual({ status: 'idle', error: null });
  });

  it('reset → idle', () => {
    failBrowserLoginFlow('x');
    resetBrowserLoginFlow();
    expect(getBrowserLoginFlowState()).toEqual({ status: 'idle', error: null });
  });

  it('fail → failed + error', () => {
    failBrowserLoginFlow('Не удалось открыть браузер');
    expect(getBrowserLoginFlowState()).toEqual({
      status: 'failed',
      error: 'Не удалось открыть браузер',
    });
  });

  it('subscribe notifies; unsubscribe stops', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBrowserLoginFlow(listener);

    beginBrowserLoginFlow();
    expect(listener).toHaveBeenCalledTimes(1);

    failBrowserLoginFlow('err');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    completeBrowserLoginFlow();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
