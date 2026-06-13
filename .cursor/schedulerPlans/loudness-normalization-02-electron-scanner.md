# Subtask 02 — Electron loudness scanner and IPC

## Type

**Desktop/Electron**

## Project

CherryPlayList (`CherryPlayList/`)

## Dependencies

None (Wave 1 — start here).

## Scope

Bundle `ffmpeg-static` for desktop builds, implement main-process loudness analysis via FFmpeg `ebur128`, expose `audio:analyzeLoudness` through the existing IPC/preload/platform channel pattern (same security model as `audio:getDuration`). Include a dedicated stderr parser module with **new** unit tests only.

### Deliverables

1. **Dependency and bundling**
   - Add `ffmpeg-static` to `package.json`.
   - Configure `electron-builder` in `package.json` (`extraResources` and/or `asarUnpack`) so the platform ffmpeg binary ships with the installer (~60–80 MB increase — expected).
   - Runtime path resolution in main process (pattern similar to AIMP bridge in `electron/aimp/service.ts`).

2. **Scanner module** (`electron/audio/loudnessScanner.ts`)
   - Spawn: `ffmpeg -hide_banner -nostats -i <path> -af ebur128=peak=true -f null -`
   - Parse integrated LUFS and true peak from stderr.
   - Compute `trackGainDb = min(targetLufs − integratedLufs, headroomDb − truePeakDb)` with `headroomDb = −1`.
   - Return success: `{ integratedLufs, truePeakDb, trackGainDb, fileMtime, scannedAt, algorithmVersion: 1, status: 'ok' }`.
   - Return failure: `{ status: 'error', errorMessage }`.
   - Accept `targetLufs` from IPC payload (renderer passes current setting; default −18).

3. **Path validation**
   - Reuse `validatePath`, `isAudioFile`, size limit from existing `audio:getDuration` flow in `electron/ipc/audio.ts`.

4. **IPC registration**
   - Handler `audio:analyzeLoudness` (single file per invoke).
   - Serial or concurrency-limited queue if multiple invokes overlap (recommend limit 1–2).

5. **File stat IPC** (`audio:statAudioFile` or `audio:getFileStat`) — **required for AC3**
   - Handler returns `{ mtimeMs: number, size: number }` for a validated local audio file path.
   - Reuse the same path validation as `audio:getDuration` (`validatePath`, `isAudioFile`, size limit).
   - Used by renderer `needsScan` in `loudnessService` to detect stale loudness when the file on disk changes.

6. **Preload and channel whitelist**
   - Add `audio:analyzeLoudness` and `audio:statAudioFile` (or chosen name) to `electron/preload.ts` invoke whitelist.

7. **Parser unit tests** (new file only)
   - `tests/electron/loudnessScanner.test.ts` — fixture-based stderr parsing, numeric range sanity, headroom gain cap math.

## Checklist

- [ ] `ffmpeg-static` installed; binary resolvable at runtime in dev and packaged build.
- [ ] `electron-builder` config includes ffmpeg for win/mac/linux targets as applicable.
- [ ] Valid local audio file returns `status: 'ok'` with numeric `integratedLufs`, `truePeakDb`, `trackGainDb`.
- [ ] `trackGainDb` respects −1 dBTP headroom cap.
- [ ] Invalid path / traversal rejected (same policy as `audio:getDuration`).
- [ ] Spawn failures return `status: 'error'` without crashing main process.
- [ ] `audio:analyzeLoudness` IPC channel registered and whitelisted in preload.
- [ ] `audio:statAudioFile` returns `{ mtimeMs, size }` for valid paths; invalid path rejected (same policy as `audio:getDuration`).
- [ ] New parser unit tests pass; **no edits** to pre-existing test files.

## Files to touch

| Area | Path |
|------|------|
| Dependencies / builder | `CherryPlayList/package.json` |
| Scanner | `CherryPlayList/electron/audio/loudnessScanner.ts` (new) |
| IPC handler | `CherryPlayList/electron/ipc/audio.ts` |
| Preload | `CherryPlayList/electron/preload.ts` |
| Path resolution reference | `CherryPlayList/electron/aimp/service.ts` (read pattern; minimal or no edit) |
| Unit tests (new) | `CherryPlayList/tests/electron/loudnessScanner.test.ts` (new) |

## Handoff to subtask 03

Renderer needs both IPC channels callable via platform layer:
- `audio:analyzeLoudness` — loudness measurement
- `audio:statAudioFile` — `{ mtimeMs, size }` for staleness checks in `needsScan`

Subtask 03 wires `PlatformAPI`, `ipcService`, platform audio contract, and web demo stub — IPC handlers must be stable before end-to-end integration testing.

## Acceptance criteria mapping

- AC1 (measurement) — partial (main-process side)
- AC3 (staleness) — `audio:statAudioFile` supplies `mtimeMs` for `needsScan`
- AC9 (safety) — invalid path rejection
