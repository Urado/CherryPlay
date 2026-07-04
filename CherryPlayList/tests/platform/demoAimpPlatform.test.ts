import { createDemoAimpBridgeState } from '../../src/shared/platform/fixtures/demoAimpBridge';
import { derivePlatformCapabilities } from '../../src/shared/platform/platformCapabilities';
import {
  getAimpAvailability,
  canStartAimpLiveStream,
} from '../../src/shared/utils/aimpStreamingAdapter';

describe('demo AIMP platform support', () => {
  test('enables supportsAimpWorkspace in demo mode', () => {
    expect(derivePlatformCapabilities('demo').supportsAimpWorkspace).toBe(true);
    expect(derivePlatformCapabilities('capacitor').supportsAimpWorkspace).toBe(false);
  });

  test('provides a connected fixture state when AIMP is selected in demo', () => {
    const state = createDemoAimpBridgeState('aimp');

    expect(getAimpAvailability(state)).toEqual({
      available: true,
      gatingReasons: [],
    });
    expect(state.connection.phase).toBe('connected');
    expect(state.playlistSnapshot?.trackCount).toBe(3);
    expect(canStartAimpLiveStream(state)).toBe(true);
  });

  test('resets to idle bridge when CherryPlay is selected in demo', () => {
    const state = createDemoAimpBridgeState('cherryPlayPlayer');

    expect(state.sourceSelection).toBe('cherryPlayPlayer');
    expect(state.connection.phase).toBe('disconnected');
    expect(state.playlistSnapshot).toBeNull();
  });
});
