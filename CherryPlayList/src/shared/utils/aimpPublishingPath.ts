export type AimpPublishingPathStatus = 'idle' | 'connecting' | 'ready' | 'error';

export interface AimpPublishingPathState {
  status: AimpPublishingPathStatus;
  error: string | null;
}

export interface AimpPublishingBridgeServices {
  checkPartyExists: (partyId: string) => Promise<boolean>;
  connect: () => Promise<void>;
  joinPartyAsOrganizer: (partyId: string) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function createAimpPublishingPathState(
  status: AimpPublishingPathStatus,
  error: string | null = null,
): AimpPublishingPathState {
  return {
    status,
    error,
  };
}

export function formatAimpPublishingPathError(
  operation:
    | 'checkPartyExists'
    | 'verifyPartyExists'
    | 'connect'
    | 'joinPartyAsOrganizer'
    | 'playlistPublish'
    | 'fullStatePublish',
  error?: unknown,
): string {
  switch (operation) {
    case 'checkPartyExists':
      return 'Linked Party was not found on the server, so the AIMP publish path cannot start.';
    case 'verifyPartyExists':
      return `Failed to verify the linked Party on the server: ${getErrorMessage(error)}`;
    case 'connect':
      return `Failed to connect the AIMP publish path to SignalR: ${getErrorMessage(error)}`;
    case 'joinPartyAsOrganizer':
      return `Failed to join the linked Party as organizer for AIMP publishing: ${getErrorMessage(
        error,
      )}`;
    case 'playlistPublish':
      return `Failed to publish the latest AIMP playlist to the linked Party: ${getErrorMessage(
        error,
      )}`;
    case 'fullStatePublish':
      return `Failed to publish the latest AIMP playback state to the linked Party: ${getErrorMessage(
        error,
      )}`;
    default:
      return `AIMP publishing failed: ${getErrorMessage(error)}`;
  }
}

/** Keep a more specific connect / not-found error instead of a generic Disconnected overwrite. */
export function shouldApplyAimpDisconnectedPublishingError(
  currentStatus: AimpPublishingPathStatus,
): boolean {
  return currentStatus !== 'error';
}

export async function startAimpPublishingBridge(
  partyId: string,
  services: AimpPublishingBridgeServices,
): Promise<AimpPublishingPathState> {
  let exists: boolean;
  try {
    exists = await services.checkPartyExists(partyId);
  } catch (error) {
    return createAimpPublishingPathState(
      'error',
      formatAimpPublishingPathError('verifyPartyExists', error),
    );
  }

  if (!exists) {
    return createAimpPublishingPathState(
      'error',
      formatAimpPublishingPathError('checkPartyExists'),
    );
  }

  try {
    await services.connect();
  } catch (error) {
    return createAimpPublishingPathState('error', formatAimpPublishingPathError('connect', error));
  }

  try {
    await services.joinPartyAsOrganizer(partyId);
  } catch (error) {
    return createAimpPublishingPathState(
      'error',
      formatAimpPublishingPathError('joinPartyAsOrganizer', error),
    );
  }

  return createAimpPublishingPathState('ready');
}
