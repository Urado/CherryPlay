import type {
  AimpEnvironmentEligibility,
  AimpGatingReason,
  AimpSourceSelection,
} from '../contracts/aimp';
import type { LayoutPreset } from '../stores/layoutStore';

export interface AimpPartyPresetState {
  visible: boolean;
  fallbackPreset: Extract<LayoutPreset, 'party' | 'player'>;
  blockingReasons: AimpGatingReason[];
}

/** Single enforce point for built-in `party` layout preset discoverability. */
export function isPartyLayoutPresetDiscoverable(partyDiscoverabilityEnabled: boolean): boolean {
  return partyDiscoverabilityEnabled;
}

export function getAimpPartyPresetState(options: {
  sourceSelection: AimpSourceSelection;
  environment: AimpEnvironmentEligibility;
  partyDiscoverabilityEnabled?: boolean;
  /** @deprecated Use `partyDiscoverabilityEnabled` from `useOnlineNetworkPolicy`. */
  enableStreaming?: boolean;
}): AimpPartyPresetState {
  const fallbackPreset: AimpPartyPresetState['fallbackPreset'] = 'party';
  const partyDiscoverabilityEnabled = options.partyDiscoverabilityEnabled ?? true;

  if (!partyDiscoverabilityEnabled) {
    return {
      visible: false,
      fallbackPreset,
      blockingReasons: [],
    };
  }

  if (options.sourceSelection !== 'aimp') {
    return {
      visible: false,
      fallbackPreset,
      blockingReasons: [
        {
          code: 'sourceNotAimp',
          message: 'AIMP + Party preset is available only while AIMP is selected as the source.',
        },
      ],
    };
  }

  if (!options.environment.eligible) {
    return {
      visible: false,
      fallbackPreset,
      blockingReasons: options.environment.gatingReasons,
    };
  }

  return {
    visible: true,
    fallbackPreset,
    blockingReasons: [],
  };
}
