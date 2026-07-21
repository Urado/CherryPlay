import * as signalR from '@microsoft/signalr';

import type { PartyLifecycleState } from '@shared/services/partyService';

export interface PlaybackPillReadinessInput {
  linkedParty: { id: string; shortCode: string; url?: string } | null;
  partyLifecycleState: PartyLifecycleState | null;
  isSessionMode: boolean;
  connectionState: signalR.HubConnectionState | null;
  connectionErrorReason: string | null;
  playerError: string | null;
}

/** Подсказки для лампочки — только то, что не дублирует текст в самой pill. */
export function getPlaybackPillReadinessHints(input: PlaybackPillReadinessInput): string[] {
  const hints: string[] = [];

  if (!input.linkedParty) {
    hints.push('Создайте или подключите вечеринку в редакторе Party.');
  } else if (input.partyLifecycleState === 'draft') {
    hints.push('Откройте вечеринку для гостей в Party Editor.');
  } else if (input.partyLifecycleState === 'completed') {
    hints.push('Вечеринка в архиве — верните на сайт, чтобы гости снова видели страницу.');
  }

  if (input.playerError) {
    hints.push(input.playerError);
  }

  if (input.linkedParty && input.isSessionMode) {
    const isConnected = input.connectionState === signalR.HubConnectionState.Connected;
    const isConnecting =
      input.connectionState === signalR.HubConnectionState.Connecting ||
      input.connectionState === signalR.HubConnectionState.Reconnecting;

    if (!isConnected && !isConnecting) {
      hints.push(
        input.connectionErrorReason
          ? `${input.connectionErrorReason} Гости могут не видеть программу.`
          : 'Нет связи с сервером — гости могут не видеть программу.',
      );
    }
  }

  return hints;
}
