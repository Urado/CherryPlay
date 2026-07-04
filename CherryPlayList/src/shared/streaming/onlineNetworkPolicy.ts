export interface StreamingNetworkPolicySettings {
  readonly enableStreaming: boolean;
}

export interface OnlineNetworkPolicy {
  /** SignalR connect, hub invokes, position ticks. */
  readonly networkEnabled: boolean;
  /**
   * Party workspace preset, gates, header indicator visibility.
   * Today mirrors `enableStreaming`; UI gates still read settings directly until UX phase.
   */
  readonly partyDiscoverabilityEnabled: boolean;
}

/**
 * Whether SignalR network activity (connect, hub invokes, position ticks) is allowed.
 * Today equivalent to `enableStreaming`; reserved for a future split from party discoverability.
 */
export function isStreamingNetworkEnabled(
  settings: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean {
  return settings.enableStreaming;
}

/**
 * Whether party-related UI should be discoverable (workspace preset, gates, header pill).
 * Today equivalent to `enableStreaming`. Do not wire to UI gates in this phase —
 * `PartyStreamingGate`, `WorkspaceMenu`, and `PlayerHeader` keep reading `enableStreaming`.
 */
export function isPartyDiscoverabilityEnabled(
  settings: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>,
): boolean {
  return settings.enableStreaming;
}

/** Snapshot for orchestrator hooks and future aggregated online-status. */
export function getOnlineNetworkPolicy(
  settings: StreamingNetworkPolicySettings,
): OnlineNetworkPolicy {
  return {
    networkEnabled: isStreamingNetworkEnabled(settings),
    partyDiscoverabilityEnabled: isPartyDiscoverabilityEnabled(settings),
  };
}
