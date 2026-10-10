import {
  resolveHeaderPlaybackTransmissionLabel,
  resolveHeaderPlaybackTransmissionState,
} from '../../src/app/components/headerPlaybackTransmission';

describe('header playback transmission', () => {
  it('distinguishes an unlinked party from transmission states', () => {
    expect(
      resolveHeaderPlaybackTransmissionState({
        hasLinkedParty: false,
        sessionActive: true,
        connected: true,
        connecting: false,
      }),
    ).toBe('unlinked');
    expect(resolveHeaderPlaybackTransmissionLabel('unlinked', true)).toBe('Вечеринка не привязана');
    expect(resolveHeaderPlaybackTransmissionLabel('unlinked', true, false)).toBeNull();
  });

  it('uses simple connection-state labels', () => {
    const state = resolveHeaderPlaybackTransmissionState({
      hasLinkedParty: true,
      sessionActive: true,
      connected: true,
      connecting: false,
    });

    expect(state).toBe('connected');
    expect(resolveHeaderPlaybackTransmissionLabel(state, true)).toBe('Связь есть');
  });

  it('shows the connection and inactive-session labels truthfully', () => {
    expect(resolveHeaderPlaybackTransmissionLabel('connecting', true)).toBe('Подключение');
    expect(resolveHeaderPlaybackTransmissionLabel('inactive', true)).toBe('Нет связи');
    expect(resolveHeaderPlaybackTransmissionLabel('inactive', false)).toBe('Трансляция не запущена');
  });
});
