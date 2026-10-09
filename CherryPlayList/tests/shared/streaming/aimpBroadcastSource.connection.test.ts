import { createDemoAimpBridgeState } from '../../../src/shared/platform/fixtures/demoAimpBridge';
import { useAimpStore } from '../../../src/shared/stores/aimpStore';
import { AimpBroadcastSource } from '../../../src/shared/streaming/AimpBroadcastSource';

describe('AimpBroadcastSource connection handling', () => {
  const source = new AimpBroadcastSource();

  afterEach(() => {
    useAimpStore.setState({
      bridgeState: createDemoAimpBridgeState('cherryPlayPlayer'),
      publishingBridgeReady: false,
    });
  });

  test('keeps the live session active and freezes position ticks when AIMP disconnects', () => {
    const bridgeState = createDemoAimpBridgeState('aimp', true);
    bridgeState.connection.phase = 'disconnected';
    bridgeState.connection.pluginConnected = false;

    useAimpStore.setState({ bridgeState, publishingBridgeReady: false });

    expect(source.isLiveSessionActive()).toBe(true);
    expect(source.shouldSendPositionTicks()).toBe(false);
  });

  test('resumes position ticks when AIMP reconnects to the active session', () => {
    const bridgeState = createDemoAimpBridgeState('aimp', true);
    useAimpStore.setState({ bridgeState, publishingBridgeReady: true });

    expect(source.isLiveSessionActive()).toBe(true);
    expect(source.shouldSendPositionTicks()).toBe(true);
  });

  test('does not keep a session active without usable snapshots', () => {
    const bridgeState = createDemoAimpBridgeState('aimp', true);
    bridgeState.playbackSnapshot = null;

    useAimpStore.setState({ bridgeState, publishingBridgeReady: false });

    expect(source.isLiveSessionActive()).toBe(false);
    expect(source.shouldSendPositionTicks()).toBe(false);
  });
});
