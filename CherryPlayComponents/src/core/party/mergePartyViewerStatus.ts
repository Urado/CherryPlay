import {
  isPartyDisplayStatusId,
  partyViewerStatusFromId,
  type PartyDisplayStatusId,
  type PartyViewerStatus,
} from '../../constants/partyViewerStatus';
import type { PartyPlaylistData, PlaybackState } from '../../types';

import { isProgramEnded } from './isProgramEnded';

export type SignalRConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface MergePartyViewerStatusInput {
  serverStatus: PartyDisplayStatusId | null | undefined;
  connectionStatus: SignalRConnectionStatus;
  apiReachable: boolean;
  playlist?: PartyPlaylistData | null;
  playbackState?: PlaybackState | null;
}

export function mergePartyViewerStatus(input: MergePartyViewerStatusInput): PartyViewerStatus {
  const { serverStatus, connectionStatus, apiReachable, playlist, playbackState } = input;

  if (serverStatus === 'party_ended') {
    return partyViewerStatusFromId('party_ended');
  }

  if (playlist && isProgramEnded(playlist, playbackState)) {
    return partyViewerStatusFromId('program_ended');
  }

  if (!apiReachable || connectionStatus === 'disconnected') {
    return partyViewerStatusFromId('server_unreachable');
  }

  if (connectionStatus === 'connecting' && !serverStatus) {
    return partyViewerStatusFromId('connecting');
  }

  if (serverStatus && isPartyDisplayStatusId(serverStatus)) {
    return partyViewerStatusFromId(serverStatus);
  }

  return partyViewerStatusFromId('scheduled');
}
