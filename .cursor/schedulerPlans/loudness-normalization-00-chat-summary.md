Temporary orchestration file; may be deleted after run.

# Chat summary — Loudness normalization (CherryPlayList)

## User goal

Implement automatic loudness normalization for tracks in CherryPlayList (Electron desktop). Files on disk must **not** be modified. Gain applied at playback time via Web Audio.

## Agreed behavior

1. **Preparation mode**: button «Рассчитать нормализацию» — batch scan all project tracks.
2. **Before session start**: ensure loudness for tracks that are missing or stale (mtime changed); **wait** until first **3** active tracks are analyzed before starting playback.
3. **During session**: when a new track is added, analyze **only that track** (background).
4. **Track row UI**: icon always visible; click shows loudness info; if not scanned — indicate + option to scan this track only.
5. **Settings**: feature can be fully disabled (no scan UI, gain = 1).
6. **Errors**: on analysis failure — play without normalization (gain = 1).

## Architecture (agreed)

- **Scanner** in Electron main via platform contract pattern (`analyzeLoudness`).
- **Storage**: `track.loudness` metadata in Track model and `.cherry` project file (alongside path, name, duration).
- **Player** does not know about LUFS — store resolves `trackGainDb` → linear gain → `setTrackGain(number)`.
- **Compression**: optional `DynamicsCompressorNode` in Web Audio chain (global toggle in settings).
- **Target**: ReplayGain 2.0 style — **−18 LUFS** (configurable in project/settings TBD).
- **Algorithm**: ITU-R BS.1770 via FFmpeg `ebur128` filter.
- **Clip prevention**: reduce gain based on true peak (−1 dBTP headroom); no limiter by default.

## Technology choices

- **Measurement**: `ffmpeg-static` + spawn `ffmpeg -af ebur128=peak=true` in Electron main (`electron/ipc/audio.ts` or dedicated module).
- **Bundle**: include ffmpeg binary via `electron-builder` (`extraResources` / `asarUnpack`) — ~60–80 MB per platform.
- **Playback**: existing `WebAudioPlaybackEngine` — `GainNode` + new `DynamicsCompressorNode`.
- **Android later**: only scanner adapter changes (`ffmpeg-kit` or Capacitor plugin); UI/store/.cherry shared. Projects prepared on PC carry loudness in `.cherry`.

## Suggested loudness fields on track

```ts
loudness?: {
  integratedLufs: number;
  truePeakDb: number;
  trackGainDb: number;
  status: 'ok' | 'pending' | 'error';
  scannedAt?: number;
  fileMtime?: number;
  algorithmVersion: number;
  errorMessage?: string;
}
```

## Out of scope (for now)

- Album gain mode
- Destructive file normalization / re-encoding
- Android scanner implementation
- Server-side (.NET) changes

## Relevant codebase

- `CherryPlayList/electron/ipc/audio.ts` — existing `audio:getDuration` via `music-metadata`
- `CherryPlayList/src/shared/audio/playback/WebAudioPlaybackEngine.ts` — gain/EQ chain
- `CherryPlayList/src/shared/services/projectService.ts` — `.cherry` serialize/deserialize
- `CherryPlayList/src/core/types/track.ts` — Track model
- `CherryPlayList/src/shared/stores/playbackStoreCore.ts` — loadTrack + `applyDefaultPlaybackEffects`
- `android_port_todo.md` — platform adapter direction for future Android

## Constraints

- Follow platform contract direction for scanner (IPC now, adapter later).
- Lint CherryPlayList after TS changes.
- Do not edit pre-existing tests without user confirmation.
