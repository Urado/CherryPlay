export type HeaderPlaybackTransmissionState = 'unlinked' | 'inactive' | 'connected' | 'connecting';

export interface HeaderPlaybackTransmissionInput {
  hasLinkedParty: boolean;
  sessionActive: boolean;
  connected: boolean;
  connecting: boolean;
}

export function resolveHeaderPlaybackTransmissionState(
  input: HeaderPlaybackTransmissionInput,
): HeaderPlaybackTransmissionState {
  if (!input.hasLinkedParty) {
    return 'unlinked';
  }
  if (!input.sessionActive) {
    return 'inactive';
  }
  if (input.connected) {
    return 'connected';
  }
  return input.connecting ? 'connecting' : 'inactive';
}

export function resolveHeaderPlaybackTransmissionLabel(
  state: HeaderPlaybackTransmissionState,
  sessionActive: boolean,
): string {
  switch (state) {
    case 'unlinked':
      return 'Вечеринка не привязана';
    case 'connected':
      return 'Связь есть';
    case 'connecting':
      return 'Подключение';
    case 'inactive':
      return sessionActive ? 'Нет связи' : 'Трансляция не запущена';
  }
}
