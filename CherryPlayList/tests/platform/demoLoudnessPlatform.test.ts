import { readFileSync } from 'fs';

import {
  DEFAULT_LOUDNESS_TARGET_LUFS,
  LOUDNESS_ALGORITHM_VERSION,
  MAX_TARGET_LUFS,
  MIN_TARGET_LUFS,
} from '../../src/shared/contracts/loudness';
import { DEMO_AUDIO_FILE_MTIME_MS } from '../../src/shared/platform/fixtures/demoAudioExtensions';
import {
  analyzeDemoLoudness,
  DEMO_LOUDNESS_PROFILES,
  handleDemoAnalyzeLoudness,
  hasDemoLoudnessProfile,
  resolveDemoAnalyzeTargetLufs,
} from '../../src/shared/platform/fixtures/demoLoudnessAnalyzer';
import { DEMO_AUDIO_FILES } from '../../src/shared/platform/fixtures/trackPaths';
import { derivePlatformCapabilities } from '../../src/shared/platform/platformCapabilities';
import { WebDemoPlatform } from '../../src/shared/platform/webDemoPlatform';

type SampleCherryTrack = {
  type: string;
  path: string;
  loudness?: {
    status: string;
    integratedLufs?: number;
    truePeakDb?: number;
    trackGainDb?: number;
    lraLu?: number;
    lraLowLufs?: number;
    fileMtime?: number;
    algorithmVersion?: number;
  };
};

type SampleCherryProject = {
  items: SampleCherryTrack[];
};

function loadSampleCherry(): SampleCherryProject {
  const raw = readFileSync('public/demo/sample.cherry', 'utf8');
  return JSON.parse(raw) as SampleCherryProject;
}

describe('demo loudness platform support', () => {
  test('enables supportsLoudnessAnalysis for demo and electron, not capacitor', () => {
    expect(derivePlatformCapabilities('demo').supportsLoudnessAnalysis).toBe(true);
    expect(derivePlatformCapabilities('capacitor').supportsLoudnessAnalysis).toBe(false);
    expect(derivePlatformCapabilities('electron').supportsLoudnessAnalysis).toBe(true);
  });

  test('every DEMO_AUDIO_FILES path has an explicit loudness profile', () => {
    for (const file of DEMO_AUDIO_FILES) {
      expect(hasDemoLoudnessProfile(file.path)).toBe(true);
      expect(DEMO_LOUDNESS_PROFILES[file.path]).toBeDefined();
    }
  });

  test('analyzes known demo audio with deterministic fixture result', () => {
    const path = '/demo/music/Artist A/Album One/morning-light.mp3';
    const result = analyzeDemoLoudness(path, DEFAULT_LOUDNESS_TARGET_LUFS);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      status: 'ok',
      integratedLufs: -14.2,
      truePeakDb: -1.5,
      fileMtime: DEMO_AUDIO_FILE_MTIME_MS,
      algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
    });
    expect(result!.trackGainDb).toBeCloseTo(-3.8, 5);
  });

  test('sample.cherry track loudness matches analyzeDemoLoudness fixtures', () => {
    const sample = loadSampleCherry();
    const tracks = sample.items.filter((item) => item.type === 'track' && item.loudness);

    expect(tracks.length).toBeGreaterThan(0);

    for (const track of tracks) {
      const analyzed = analyzeDemoLoudness(track.path, DEFAULT_LOUDNESS_TARGET_LUFS);
      expect(analyzed).not.toBeNull();
      expect(analyzed!.status).toBe('ok');
      expect(track.loudness).toEqual(
        expect.objectContaining({
          status: 'ok',
          integratedLufs: analyzed!.integratedLufs,
          truePeakDb: analyzed!.truePeakDb,
          lraLu: analyzed!.lraLu,
          lraLowLufs: analyzed!.lraLowLufs,
          fileMtime: analyzed!.fileMtime,
          algorithmVersion: analyzed!.algorithmVersion,
        }),
      );
      expect(track.loudness!.trackGainDb).toBeCloseTo(analyzed!.trackGainDb, 5);
    }
  });

  test('rejects non-audio paths and out-of-range targetLufs via IPC handlers', () => {
    expect(handleDemoAnalyzeLoudness({ path: '/demo/music/readme.txt' })).toEqual({
      success: false,
      error: 'Path is not an audio file',
    });

    expect(
      handleDemoAnalyzeLoudness({
        path: '/demo/music/demo-track.mp3',
        targetLufs: MIN_TARGET_LUFS - 1,
      }),
    ).toEqual({
      success: false,
      error: `targetLufs must be between ${MIN_TARGET_LUFS} and ${MAX_TARGET_LUFS}`,
    });

    expect(
      handleDemoAnalyzeLoudness({
        path: '/demo/music/missing-track.mp3',
      }),
    ).toMatchObject({
      success: false,
    });
  });

  test('non-finite targetLufs falls back to default', () => {
    expect(resolveDemoAnalyzeTargetLufs(Number.NaN)).toEqual({
      ok: true,
      targetLufs: DEFAULT_LOUDNESS_TARGET_LUFS,
    });
    expect(resolveDemoAnalyzeTargetLufs(Number.POSITIVE_INFINITY)).toEqual({
      ok: true,
      targetLufs: DEFAULT_LOUDNESS_TARGET_LUFS,
    });
    expect(resolveDemoAnalyzeTargetLufs('12' as unknown)).toEqual({
      ok: true,
      targetLufs: DEFAULT_LOUDNESS_TARGET_LUFS,
    });
  });

  test('WebDemoPlatform routes analyze and stat to fixture handlers', async () => {
    const platform = new WebDemoPlatform();
    const path = '/demo/music/demo-track.mp3';

    const analyze = await platform.invoke('audio:analyzeLoudness', {
      path,
      targetLufs: DEFAULT_LOUDNESS_TARGET_LUFS,
    });
    expect(analyze.success).toBe(true);
    expect(analyze.data).toMatchObject({
      status: 'ok',
      fileMtime: DEMO_AUDIO_FILE_MTIME_MS,
      algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
    });

    const stat = await platform.invoke('audio:statAudioFile', { path });
    expect(stat).toEqual({
      success: true,
      data: {
        mtimeMs: DEMO_AUDIO_FILE_MTIME_MS,
        size: 12_345,
      },
    });
  });
});
