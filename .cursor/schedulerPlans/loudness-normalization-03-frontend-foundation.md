# Subtask 03 — Frontend foundation (model, settings, service, store)

## Type

**Frontend**

## Project

CherryPlayList (`CherryPlayList/`)

## Dependencies

- [loudness-normalization-02-electron-scanner.md](./loudness-normalization-02-electron-scanner.md) — IPC `audio:analyzeLoudness` must exist for integration testing (types/platform wiring can proceed in parallel).

## Scope

Establish the renderer-side data model, persistence, app settings, platform contract, loudness service, and project store mutations. No playback graph or player UI in this subtask.

### Deliverables

1. **`TrackLoudness` type and Track model**
   - Add optional `loudness?: TrackLoudness` on `Track`.
   - Fields: `integratedLufs`, `truePeakDb`, `trackGainDb`, `status: 'ok' | 'pending' | 'error'`, `scannedAt?`, `fileMtime?`, `algorithmVersion`, `errorMessage?`.

2. **`.cherry` persistence**
   - Extend `SavedProjectTrack` and `projectService` serialize/deserialize to round-trip `loudness`.
   - Backward compatible: missing field ⇒ unscanned.

3. **App settings** (`settingsStore`)
   - `loudnessNormalizationEnabled: boolean` (default `true`)
   - `loudnessTargetLufs: number` (default `-18`)
   - `loudnessCompressionEnabled: boolean` (default `false`)
   - Persist via existing settings persistence mechanism.

4. **Platform contract**
   - Add `analyzeLoudness` to `PlatformAPI` / `InvokeChannel` in `platform/types.ts`.
   - Add `statAudioFile` (or matching IPC name) returning `{ mtimeMs, size }` — same path validation contract as duration.
   - Wire `ipcService` to invoke `audio:analyzeLoudness` and `audio:statAudioFile`.
   - Expose both via platform audio adapter (follow existing `getDuration` pattern).
   - Web demo / Capacitor stub: graceful error, capability flag so UI can hide later.

5. **`loudnessService.ts`** (`src/shared/services/loudnessService.ts`)
   - `needsScan(track): boolean` — feature disabled ⇒ false; else missing/stale (`fileMtime` mismatch vs `statAudioFile` `mtimeMs`)/error/`algorithmVersion` mismatch.
   - `scanTrack(track): Promise<TrackLoudness>` — set `status: 'pending'` on scan start (via store update before IPC); on success persist `fileMtime` from `statAudioFile`; invoke `analyzeLoudness` IPC.
   - `scanTracks(tracks, onProgress?, cancelToken?)` — sequential queue with cancel support; each track gets `status: 'pending'` when its scan begins.
   - `resolveLinearGain(track, settings): number` — disabled or invalid ⇒ `1`; else `10^(trackGainDb/20)` clamped to engine range (0–2).

6. **Store integration** (`projectStore`)
   - `updateTrackLoudness(trackId, loudness)` — mutates track, `markAsDirty`.
   - Hook `addItem` / `addItems` — when feature enabled, enqueue background scan for new tracks (gain = 1 until complete).

7. **Unit tests** (required, new file only) — **AC10**
   - `tests/shared/services/loudnessService.test.ts` — gain resolver (`resolveLinearGain`) and `needsScan` staleness logic (including `fileMtime` vs `statAudioFile` mismatch).

8. **Lint**
   - Run `cd CherryPlayList && npm run lint:fix` after all TS/TSX changes in this subtask.

## Checklist

- [ ] `TrackLoudness` type exported; `Track.loudness` optional.
- [ ] Save/reload `.cherry` preserves `track.loudness`.
- [ ] Settings fields persist across app restart.
- [ ] `analyzeLoudness` and `statAudioFile` reachable from renderer on Electron; web demo returns graceful error.
- [ ] `needsScan` true when loudness missing, `status !== 'ok'`, or `fileMtime` stale vs `statAudioFile` `mtimeMs`.
- [ ] `scanTrack` / `scanTracks` set `status: 'pending'` when scan starts.
- [ ] `resolveLinearGain` returns `1` when feature disabled or loudness invalid.
- [ ] `updateTrackLoudness` marks project dirty.
- [ ] Background scan enqueued on `addItem` / `addItems` when feature enabled.
- [ ] `loudnessService.test.ts` passes (gain resolver + `needsScan` staleness) — **required**.
- [ ] `npm run lint:fix` passes with no errors.
- [ ] **No edits** to pre-existing test files.

## Files to touch

| Area | Path |
|------|------|
| Track model | `CherryPlayList/src/core/types/track.ts` |
| Saved project shape | `CherryPlayList/src/core/types/project.ts` (or equivalent `SavedProjectTrack`) |
| Serialize/deserialize | `CherryPlayList/src/shared/services/projectService.ts` |
| Settings | `CherryPlayList/src/shared/stores/settingsStore.ts` |
| Loudness service (new) | `CherryPlayList/src/shared/services/loudnessService.ts` |
| Project store | `CherryPlayList/src/shared/stores/projectStore.ts` |
| Platform types | `CherryPlayList/src/shared/platform/types.ts` |
| IPC bridge | `CherryPlayList/src/shared/services/ipcService.ts` |
| Web demo stub | `CherryPlayList/src/shared/platform/webDemoPlatform.ts` (or equivalent adapter) |
| Platform audio adapter | `CherryPlayList/src/shared/platform/*Audio*` (follow existing adapter pattern) |
| Unit tests (new, required) | `CherryPlayList/tests/shared/services/loudnessService.test.ts` (new) |

## Handoff to subtask 04

Subtask 04 consumes `loudnessService`, settings, and store mutations for playback effects, session gate, and UI. `resolveLinearGain` API must be stable.

## Acceptance criteria mapping

- AC1 (storage) — `.cherry` round-trip
- AC3 (staleness) — `statAudioFile` + `needsScan` / re-scan updates
- AC10 (tests) — `loudnessService.test.ts` required
- AC6 (runtime track add) — background scan hook
- AC9 (web demo) — graceful stub
