import { getPlatformCapabilities } from '../platform/platformCapabilities';
import { isPlatformInitialized } from '../platform/platformContext';

export interface StreamingNetworkPolicySettings {
  readonly enableStreaming: boolean;
}

export interface OnlineNetworkPolicy {
  readonly networkEnabled: boolean;
  readonly partyDiscoverabilityEnabled: boolean;
}

export const isStreamingNetworkEnabled = (
  settings: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean => {
  return settings.enableStreaming;
};

export const isStreamingHubAllowed = (
  settings: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean => {
  if (!isStreamingNetworkEnabled(settings)) {
    return false;
  }
  if (!isPlatformInitialized()) {
    return false;
  }
  return getPlatformCapabilities().supportsRealAuth;
};

export const isPartyDiscoverabilityEnabled = (
  _settings?: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean => {
  return true;
};

export const getOnlineNetworkPolicy = (
  settings: StreamingNetworkPolicySettings,
): OnlineNetworkPolicy => {
  return {
    networkEnabled: isStreamingNetworkEnabled(settings),
    partyDiscoverabilityEnabled: isPartyDiscoverabilityEnabled(settings),
  };
};
