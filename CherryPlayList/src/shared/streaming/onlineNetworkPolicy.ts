import { getAppMode } from '../platform/appMode';

export interface StreamingNetworkPolicySettings {
  readonly enableStreaming: boolean;
}

export interface OnlineNetworkPolicy {
  /** SignalR connect, hub invokes, position ticks, Party REST actions. */
  readonly networkEnabled: boolean;
  /**
   * Party workspace preset, zones, and editor shell visibility.
   * Always true — offline/privacy mode shows in-zone stubs instead of hiding Party.
   */
  readonly partyDiscoverabilityEnabled: boolean;
}

/**
 * Whether SignalR network activity (connect, hub invokes, position ticks) is allowed.
 * Reflects user «Онлайн» toggle and demo mode. Internal only — not a Settings label.
 */
export function isStreamingNetworkEnabled(
  settings: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean {
  if (getAppMode() === 'demo') {
    return false;
  }
  return settings.enableStreaming;
}

/**
 * Whether party-related UI should be discoverable (workspace preset, zones, editor shell).
 * Independent of `enableStreaming` — Party stays visible when «Онлайн» is off.
 */
export function isPartyDiscoverabilityEnabled(
  _settings?: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean {
  return true;
}

/** Snapshot for orchestrator hooks and aggregated online-status. */
export function getOnlineNetworkPolicy(
  settings: StreamingNetworkPolicySettings,
): OnlineNetworkPolicy {
  return {
    networkEnabled: isStreamingNetworkEnabled(settings),
    partyDiscoverabilityEnabled: isPartyDiscoverabilityEnabled(settings),
  };
}
