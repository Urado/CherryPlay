import type { AimpPublishingPathStatus } from '@shared/utils';

export interface AimpServerConnectionStatus {
  name: 'Сервер';
  label: string;
  state: 'connected' | 'connecting' | 'disconnected';
}

interface AimpServerConnectionStatusInput {
  isAuthenticated: boolean;
  enableStreaming: boolean;
  linkedPartyId: string | null;
  publishingPathStatus: AimpPublishingPathStatus;
}

export const resolveAimpServerConnectionStatus = (
  input: AimpServerConnectionStatusInput,
): AimpServerConnectionStatus => {
  if (!input.isAuthenticated) {
    return { name: 'Сервер', label: 'Войдите в аккаунт', state: 'disconnected' };
  }

  if (!input.enableStreaming) {
    return { name: 'Сервер', label: 'Онлайн выключен', state: 'disconnected' };
  }

  if (input.linkedPartyId === null) {
    return { name: 'Сервер', label: 'Вечеринка не привязана', state: 'disconnected' };
  }

  if (input.publishingPathStatus === 'ready') {
    return { name: 'Сервер', label: 'На связи', state: 'connected' };
  }

  if (input.publishingPathStatus === 'reconnecting') {
    return { name: 'Сервер', label: 'Восстанавливаем связь', state: 'connecting' };
  }

  if (input.publishingPathStatus === 'connecting') {
    return { name: 'Сервер', label: 'Подключаемся', state: 'connecting' };
  }

  if (input.publishingPathStatus === 'error') {
    return { name: 'Сервер', label: 'Нет связи', state: 'disconnected' };
  }

  return { name: 'Сервер', label: 'Не подключён', state: 'disconnected' };
};
