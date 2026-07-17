export { LOUDNESS_ALGORITHM_VERSION } from '../../shared/contracts/loudness';

export type TrackLoudnessStatus = 'ok' | 'pending' | 'error';

/**
 * Per-track loudness metadata from FFmpeg ebur128 analysis (persisted in `.cherry`).
 */
export interface TrackLoudness {
  status: TrackLoudnessStatus;
  integratedLufs?: number;
  /** EBU R128 10th-percentile loudness — proxy for quiet passages (~bottom 10% of track). */
  lraLowLufs?: number;
  /** Loudness range (LRA) in LU from ebur128. */
  lraLu?: number;
  truePeakDb?: number;
  trackGainDb?: number;
  /** User override; when set, replaces {@link trackGainDb} for playback. */
  manualGainDb?: number;
  /** User override for adaptive compression strength (0…1); replaces auto calculation. */
  manualCompressionStrength?: number;
  fileMtime?: number;
  algorithmVersion?: typeof LOUDNESS_ALGORITHM_VERSION;
  errorMessage?: string;
}

export interface Track {
  id: string;
  path: string;
  name: string;
  duration?: number; // Duration in seconds
  isMissing?: boolean;
  loudness?: TrackLoudness;
}
