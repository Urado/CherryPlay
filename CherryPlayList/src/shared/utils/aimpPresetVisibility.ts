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

export function getAimpPartyPresetState(options: {
  sourceSelection: AimpSourceSelection;
  environment: AimpEnvironmentEligibility;
  enableStreaming: boolean;
}): AimpPartyPresetState {
  const fallbackPreset: AimpPartyPresetState['fallbackPreset'] = options.enableStreaming
    ? 'party'
    : 'player';

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
