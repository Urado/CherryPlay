import {
  derivePlatformCapabilities,
  getPlatformCapabilities,
} from '../../../src/shared/platform/platformCapabilities';
import { setPlatform } from '../../../src/shared/platform/platformContext';
import type { PlatformAPI } from '../../../src/shared/platform/types';
import {
  getOnlineNetworkPolicy,
  isStreamingHubAllowed,
  isStreamingNetworkEnabled,
} from '../../../src/shared/streaming/onlineNetworkPolicy';

function createStubPlatform(): PlatformAPI {
  return {
    getPathForFile: () => '',
    invoke: async () => ({ success: false, error: 'stub' }),
    on: () => () => undefined,
    aimp: {
      getState: async () => ({ success: false, error: 'stub' }),
      setSourceSelection: async () => ({ success: false, error: 'stub' }),
      setLiveStreamStarted: async () => ({ success: false, error: 'stub' }),
      onStateChanged: () => () => undefined,
      onLog: () => () => undefined,
    },
  };
}

describe('onlineNetworkPolicy dual-mode', () => {
  const originalDemoLive = process.env.VITE_DEMO_LIVE;

  afterEach(() => {
    if (originalDemoLive === undefined) {
      delete process.env.VITE_DEMO_LIVE;
    } else {
      process.env.VITE_DEMO_LIVE = originalDemoLive;
    }
    setPlatform(createStubPlatform(), 'electron');
  });

  test('networkEnabled mirrors enableStreaming without demo hard-disable', () => {
    expect(isStreamingNetworkEnabled({ enableStreaming: true })).toBe(true);
    expect(isStreamingNetworkEnabled({ enableStreaming: false })).toBe(false);
    expect(getOnlineNetworkPolicy({ enableStreaming: true }).networkEnabled).toBe(true);
    expect(getOnlineNetworkPolicy({ enableStreaming: false }).networkEnabled).toBe(false);
  });

  test('hub is blocked in fixtures demo even when Online is ON', () => {
    delete process.env.VITE_DEMO_LIVE;
    setPlatform(createStubPlatform(), 'demo');
    expect(getPlatformCapabilities().supportsRealAuth).toBe(false);
    expect(isStreamingHubAllowed({ enableStreaming: true })).toBe(false);
  });

  test('live demo allows hub when Online is ON and supportsRealAuth', () => {
    process.env.VITE_DEMO_LIVE = '1';
    setPlatform(createStubPlatform(), 'demo');
    expect(getPlatformCapabilities().supportsRealAuth).toBe(true);
    expect(isStreamingHubAllowed({ enableStreaming: true })).toBe(true);
    expect(isStreamingHubAllowed({ enableStreaming: false })).toBe(false);
  });

  test('electron keeps hub allowed when Online is ON', () => {
    setPlatform(createStubPlatform(), 'electron');
    expect(isStreamingHubAllowed({ enableStreaming: true })).toBe(true);
    expect(isStreamingHubAllowed({ enableStreaming: false })).toBe(false);
  });

  test('derivePlatformCapabilities demo reflects live flag for supportsRealAuth', () => {
    delete process.env.VITE_DEMO_LIVE;
    expect(derivePlatformCapabilities('demo').supportsRealAuth).toBe(false);
    process.env.VITE_DEMO_LIVE = '1';
    expect(derivePlatformCapabilities('demo').supportsRealAuth).toBe(true);
  });
});
