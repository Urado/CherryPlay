import { getPlatformCapabilities } from '../platform/platformCapabilities';
import { isPlatformInitialized } from '../platform/platformContext';

export interface StreamingNetworkPolicySettings {
  readonly enableStreaming: boolean;
}

export interface OnlineNetworkPolicy {
  readonly networkEnabled: boolean;
  readonly partyDiscoverabilityEnabled: boolean;
}

export function isStreamingNetworkEnabled(
  settings: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean {
  return settings.enableStreaming;
}

export function isStreamingHubAllowed(
  settings: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean {
  if (!isStreamingNetworkEnabled(settings)) {
    return false;
  }
  if (!isPlatformInitialized()) {
    return false;
  }
  return getPlatformCapabilities().supportsRealAuth;
}

export function isPartyDiscoverabilityEnabled(
  _settings?: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean {
  return true;
}

export function getOnlineNetworkPolicy(
  settings: StreamingNetworkPolicySettings,
): OnlineNetworkPolicy {
  return {
    networkEnabled: isStreamingNetworkEnabled(settings),
    partyDiscoverabilityEnabled: isPartyDiscoverabilityEnabled(settings),
  };
}
