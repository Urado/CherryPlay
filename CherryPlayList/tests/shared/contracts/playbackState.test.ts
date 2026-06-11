import {
  mapAimpPlaybackStatusToWireStatus,
  mapStoreStatusToWireStatus,
} from '../../../src/shared/contracts/playbackState';

describe('mapStoreStatusToWireStatus', () => {
  test('maps wire statuses 1:1', () => {
    expect(mapStoreStatusToWireStatus('idle')).toBe('idle');
    expect(mapStoreStatusToWireStatus('playing')).toBe('playing');
    expect(mapStoreStatusToWireStatus('paused')).toBe('paused');
    expect(mapStoreStatusToWireStatus('ended')).toBe('ended');
  });

  test('maps transitional store statuses to playing', () => {
    expect(mapStoreStatusToWireStatus('loading')).toBe('playing');
    expect(mapStoreStatusToWireStatus('buffering')).toBe('playing');
  });

  test('maps error to idle', () => {
    expect(mapStoreStatusToWireStatus('error')).toBe('idle');
  });
});

describe('mapAimpPlaybackStatusToWireStatus', () => {
  test('maps AIMP statuses to wire contract', () => {
    expect(mapAimpPlaybackStatusToWireStatus('playing')).toBe('playing');
    expect(mapAimpPlaybackStatusToWireStatus('paused')).toBe('paused');
    expect(mapAimpPlaybackStatusToWireStatus('stopped')).toBe('idle');
    expect(mapAimpPlaybackStatusToWireStatus(null)).toBe('idle');
    expect(mapAimpPlaybackStatusToWireStatus(undefined)).toBe('idle');
  });
});
