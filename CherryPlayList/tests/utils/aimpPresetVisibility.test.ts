import { getAimpPartyPresetState } from '../../src/shared/utils/aimpPresetVisibility';

describe('getAimpPartyPresetState', () => {
  test('hides the preset until AIMP is the selected source', () => {
    const result = getAimpPartyPresetState({
      sourceSelection: 'cherryPlayPlayer',
      environment: {
        eligible: true,
        pipeName: '\\\\.\\pipe\\cherryplay-aimp-v1',
        platform: 'win32',
        architecture: 'x64',
        gatingReasons: [],
      },
      enableStreaming: true,
    });

    expect(result).toEqual({
      visible: false,
      fallbackPreset: 'party',
      blockingReasons: [
        {
          code: 'sourceNotAimp',
          message: 'AIMP + Party preset is available only while AIMP is selected as the source.',
        },
      ],
    });
  });

  test('shows the preset only when AIMP is selected and the environment is eligible', () => {
    const result = getAimpPartyPresetState({
      sourceSelection: 'aimp',
      environment: {
        eligible: true,
        pipeName: '\\\\.\\pipe\\cherryplay-aimp-v1',
        platform: 'win32',
        architecture: 'x64',
        gatingReasons: [],
      },
      enableStreaming: false,
    });

    expect(result).toEqual({
      visible: true,
      fallbackPreset: 'player',
      blockingReasons: [],
    });
  });

  test('uses the same helper to keep fallback deterministic when the environment becomes ineligible', () => {
    const result = getAimpPartyPresetState({
      sourceSelection: 'aimp',
      environment: {
        eligible: false,
        pipeName: '\\\\.\\pipe\\cherryplay-aimp-v1',
        platform: 'linux',
        architecture: 'x64',
        gatingReasons: [
          {
            code: 'unsupportedPlatform',
            message: 'AIMP mode is supported only on Windows.',
          },
        ],
      },
      enableStreaming: false,
    });

    expect(result.visible).toBe(false);
    expect(result.fallbackPreset).toBe('player');
    expect(result.blockingReasons).toEqual([
      {
        code: 'unsupportedPlatform',
        message: 'AIMP mode is supported only on Windows.',
      },
    ]);
  });
});
