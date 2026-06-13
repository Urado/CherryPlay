Temporary orchestration file; may be deleted after run.

# Technical specification — Loudness normalization (CherryPlayList)

## Restatement of the ask

Implement **non-destructive loudness normalization** for CherryPlayList (Electron desktop): measure each track's integrated loudness (LUFS) and true peak via FFmpeg `ebur128`, persist results in the project (`.cherry`), and apply per-track gain at **playback time** through the existing Web Audio chain — without modifying audio files on disk.

---

## Assumptions

| # | Assumption |
|---|------------|
| A1 | **Electron-only scanner for v1.** Android/Capacitor will reuse the same `Track.loudness` schema and store logic; only the platform adapter for `analyzeLoudness` changes later. |
| A2 | **Target loudness default is −18 LUFS** (ReplayGain 2.0 track-gain reference). Configurable target lives in **app settings** (persisted via `settingsStore`); per-project override is optional follow-up. |
| A3 | **Stale detection** uses `fileMtime` (from `fs.stat`) compared to `track.loudness.fileMtime`. Missing `loudness`, `status !== 'ok'`, or mtime mismatch ⇒ needs (re)scan. |
| A4 | **"Active tracks"** for the session-start gate are tracks that would play in session: not in `disabledTrackIds`, not in a disabled group, not already in `playedTrackIds` (same semantics as `isTrackActive` in `PlayerViewContainer`). |
| A5 | **First 3 active tracks** means the first three in playlist order among active tracks; session start is blocked until all three have `loudness.status === 'ok'` (or feature disabled). Fewer than 3 active tracks ⇒ wait for all available. |
| A6 | **Gain math** lives in renderer store/service layer: `trackGainDb` is precomputed at scan time; playback converts `db → linear` and calls `engine.setTrackGain(linear)`. `WebAudioPlaybackEngine` does not parse LUFS. |
| A7 | **Clip prevention** at scan time: `trackGainDb = min(targetLufs − integratedLufs, headroomDb − truePeakDb)` where `headroomDb = −1` dBTP. No limiter node in v1. |
| A8 | **`algorithmVersion`** starts at `1`; bump when measurement formula or target reference changes to trigger optional re-scan. |
| A9 | **ffmpeg-static** binary is bundled per platform via `electron-builder` (`extraResources` and/or `asarUnpack`); main process resolves path at runtime (pattern similar to AIMP bridge in `electron/aimp/service.ts`). |
| A10 | **Existing `setAutoGainEnabled` placeholder** in `effects.ts` is superseded by real per-track gain; placeholder autogain should not run when loudness normalization is enabled. |
| A11 | **Pre-existing tests** are not edited unless the user explicitly confirms (workspace rule). New tests for new modules are allowed. |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Installer size +60–80 MB** per platform | Slower downloads, CI artifact growth | Bundle ffmpeg only in desktop builds; document size impact; lazy-init scanner on first use. |
| **Long batch scans** block UX | User waits on large playlists | Progress reporting for batch scan; cancellable queue; session gate only for first 3 tracks. |
| **FFmpeg spawn failures** (AV, missing binary, corrupt file) | No normalization for affected tracks | `status: 'error'`, `gain = 1` at playback; surface error in track info popover. |
| **ebur128 stderr parsing fragility** | Wrong LUFS/peak values | Dedicated parser module with fixture-based unit tests in main; validate numeric ranges. |
| **Race: track plays before scan completes** | Wrong volume | Session-start gate; on track load apply gain=1 until `status === 'ok'`; background scan updates store then re-applies if current track. |
| **`.cherry` schema drift** | Old projects load without loudness | Optional `loudness` field — backward compatible; missing ⇒ treat as unscanned. |
| **Portable export** | Loudness metadata lost or paths stale | Serialize `loudness` in `SavedProjectTrack`; re-validate mtime on load; portable copy keeps relative paths — mtime check still works on copied files. |
| **Web demo / Capacitor** | `analyzeLoudness` unavailable | Platform capability flag; stub returns error; UI hidden or disabled when capability absent. |
| **Concurrent FFmpeg processes** | CPU/memory spike on batch | Serial or small concurrency limit (e.g. 1–2) in main-process scan queue. |

---

## Minimal implementation path

Ordered phases that deliver end-to-end value with the smallest coherent scope.

### Phase 1 — Data model and persistence

1. Add `TrackLoudness` type and optional `loudness?: TrackLoudness` on `Track` (`src/core/types/track.ts`).
2. Extend `SavedProjectTrack` and `projectService` serialize/deserialize to round-trip `loudness`.
3. Add app-level settings to `settingsStore` (persisted):
   - `loudnessNormalizationEnabled: boolean` (default `true`)
   - `loudnessTargetLufs: number` (default `-18`)
   - `loudnessCompressionEnabled: boolean` (default `false`)
4. Bump or document `.cherry` track shape in project validation if needed (field optional — no version bump required).

### Phase 2 — Electron scanner (main process)

1. Add `ffmpeg-static` dependency; configure `electron-builder` `extraResources` / unpack for the platform binary.
2. Create `electron/audio/loudnessScanner.ts` (or extend `electron/ipc/audio.ts`):
   - Spawn: `ffmpeg -hide_banner -nostats -i <path> -af ebur128=peak=true -f null -`
   - Parse integrated LUFS and true peak from stderr.
   - Compute `trackGainDb` with −1 dBTP headroom cap.
   - Return `{ integratedLufs, truePeakDb, trackGainDb, fileMtime, scannedAt, algorithmVersion: 1, status: 'ok' }` or `{ status: 'error', errorMessage }`.
3. Reuse existing path validation from `audio:getDuration` (`validatePath`, `isAudioFile`, size limit).
4. Register IPC `audio:analyzeLoudness` (single file); optional `audio:analyzeLoudnessBatch` or renderer-side queue calling single handler repeatedly.
5. Expose via `preload.ts`, `PlatformAPI` / `InvokeChannel`, `ipcService`, and `PlatformAudioAdapter` or dedicated `LoudnessPlatformAdapter` following platform-contract direction.

### Phase 3 — Renderer loudness service and store integration

1. Create `src/shared/services/loudnessService.ts`:
   - `needsScan(track): boolean` — disabled feature ⇒ false; else missing/stale/error.
   - `scanTrack(track): Promise<TrackLoudness>` — IPC + mtime check.
   - `scanTracks(tracks, onProgress?)` — sequential queue with cancel token.
   - `resolveLinearGain(track): number` — disabled or no valid loudness ⇒ `1`; else `10^(trackGainDb/20)`.
2. Extend `projectStore` (or thin `loudnessStore`) with:
   - `updateTrackLoudness(trackId, loudness)` — mutates track, `markAsDirty`.
   - Hook `addItem` / `addItems` — enqueue background scan for new tracks when feature enabled.
3. Replace `applyDefaultPlaybackEffects` usage path: after load, call new `applyPlaybackEffects(engine, track, settings)` that sets track gain from `resolveLinearGain`, EQ defaults, compression toggle.

### Phase 4 — Web Audio compression toggle

1. Add optional `DynamicsCompressorNode` in `WebAudioPlaybackEngine` graph (after track gain, before or after EQ — document choice; recommend after EQ, before master gain).
2. Add `setCompressionEnabled(enabled: boolean)` to `PlaybackEffects`; wired from settings on each track load.
3. Use conservative defaults (e.g. threshold −24 dB, ratio 4:1, knee 30, attack 0.003, release 0.25) — tuning is non-blocking for v1.

### Phase 5 — Session-start gate and preparation batch UI

1. **Preparation mode** — add button «Рассчитать нормализацию» in player preparation UI (`PlayerViewContainer` / `PlayerHeader` area):
   - Scans all project tracks (or all needing scan).
   - Shows progress (count / current file name).
2. **Session start** — extend `usePlayerSession.handleStartSession`:
   - Before `startSession()` + `loadPlayerTrack`, identify active tracks needing scan.
   - Await scan completion for **first 3** active tracks (or all if fewer).
   - Show blocking progress UI while waiting; allow cancel ⇒ abort session start.
3. **During session** — background scan for newly added tracks only; no re-block unless user starts new session.

### Phase 6 — Track row UI

1. Add always-visible loudness icon on track rows (`ProjectItemRow` or wrapper in `PlayerTracksList` / `PlaylistView`):
   - States: ok (normalized), pending (spinner), unscanned, error.
2. Click opens popover/modal with: integrated LUFS, true peak, applied gain (dB), scan time, error message.
3. Actions: «Сканировать» (single track) when unscanned/stale/error.
4. When feature disabled in settings — hide icon and scan UI.

### Phase 7 — Settings UI

1. Add section in app settings (where audio/device settings live):
   - Enable loudness normalization (master toggle).
   - Target LUFS (number input, default −18).
   - Enable compression (toggle).
2. When disabled: no scan UI, `resolveLinearGain` always returns `1`, compressor off.

---

## Acceptance criteria (testable)

### AC1 — Measurement and storage

- [ ] Given a valid local audio file, `audio:analyzeLoudness` returns `status: 'ok'` with numeric `integratedLufs`, `truePeakDb`, and `trackGainDb`.
- [ ] `trackGainDb` never exceeds `−1 dBTP − truePeakDb` (headroom respected).
- [ ] Saving and reloading a `.cherry` project preserves `track.loudness` for each track.

### AC2 — Playback gain

- [ ] With normalization **enabled** and track `status: 'ok'`, loaded track applies `setTrackGain(linear)` where `linear = 10^(trackGainDb/20)` (within engine clamp 0–2).
- [ ] With normalization **disabled**, every track plays at `setTrackGain(1)` regardless of stored loudness.
- [ ] With `status: 'error'` or missing loudness, track plays at gain `1` (no throw, no playback block except session-start gate).

### AC3 — Staleness

- [ ] After file mtime changes on disk, `needsScan(track)` returns true even if previous `status === 'ok'`.
- [ ] Re-scan updates `fileMtime`, `scannedAt`, and recomputed `trackGainDb`.

### AC4 — Preparation batch

- [ ] In preparation mode, «Рассчитать нормализацию» scans all tracks needing scan and updates project state.
- [ ] Progress indicator advances per completed track; errors on individual tracks do not abort entire batch.

### AC5 — Session start gate

- [ ] Starting session with ≥3 active unscanned/stale tracks shows wait UI until first 3 active tracks are `ok`.
- [ ] With <3 active tracks, session starts only after all active tracks are `ok`.
- [ ] With all active tracks already scanned, session starts without extra delay.
- [ ] With feature disabled, session starts immediately (no scan, no wait UI).

### AC6 — Runtime track add

- [ ] Adding a track during session triggers background scan for that track only.
- [ ] Playback of that track before scan completes uses gain `1`; after scan completes, switching to or re-loading the track applies normalized gain.

### AC7 — Track row UI

- [ ] Loudness icon visible on track rows when feature enabled.
- [ ] Click shows loudness details for scanned tracks.
- [ ] Unscanned track shows unscanned state + single-track scan action.
- [ ] Icon and scan affordances hidden when feature disabled.

### AC8 — Compression

- [ ] When compression toggle on, `DynamicsCompressorNode` is in the active audio graph; when off, bypassed or not connected.
- [ ] Toggling setting affects next `loadTrack` (no requirement to re-scan).

### AC9 — Safety and platform

- [ ] Invalid path / traversal rejected (same as `audio:getDuration`).
- [ ] Original audio files on disk are never modified.
- [ ] Web demo adapter returns graceful error for `analyzeLoudness`; app does not crash.

### AC10 — Quality gates

- [ ] `npm run lint:fix` passes in CherryPlayList after TS changes.
- [ ] New unit tests cover gain resolver and ebur128 parser; existing tests untouched unless user approves.

---

## Constraints

- **Scope:** CherryPlayList Electron desktop only for scanner implementation. No CherryPlayServer (.NET) changes. No album-gain mode. No destructive normalization.
- **Architecture:** Scanner behind platform contract (`analyzeLoudness`); renderer store owns LUFS → gain conversion; player engine receives linear gain only.
- **Files on disk:** Read-only analysis; gain applied in Web Audio only.
- **Bundle:** Include `ffmpeg-static` via electron-builder; expect ~60–80 MB installer increase per platform.
- **Algorithm:** ITU-R BS.1770 via FFmpeg `ebur128=peak=true`; target −18 LUFS default; `algorithmVersion: 1`.
- **Error policy:** Fail open at playback (gain = 1); persist error on track for UI.
- **Tests:** Do not edit pre-existing test files without explicit user confirmation.
- **Lint:** Run `CherryPlayList` `lint:fix` after TS/TSX changes.
- **Documentation:** Update module docs for playback chain, IPC channels, and `.cherry` track schema.

---

## Suggested subtask breakdown (scheduler hints)

### Electron / Main process

| ID | Task | Key files |
|----|------|-----------|
| E1 | Add `ffmpeg-static`, electron-builder resource wiring | `package.json`, electron-builder config |
| E2 | Implement `loudnessScanner` + ebur128 stderr parser | `electron/audio/loudnessScanner.ts` |
| E3 | IPC `audio:analyzeLoudness` + preload whitelist | `electron/ipc/audio.ts`, `electron/preload.ts` |
| E4 | Unit tests for parser (new test file only) | `tests/electron/loudnessScanner.test.ts` |

### Frontend / Renderer

| ID | Task | Key files |
|----|------|-----------|
| F1 | `TrackLoudness` type + `.cherry` serialize/deserialize | `track.ts`, `project.ts`, `projectService.ts` |
| F2 | Settings fields + settings UI section | `settingsStore.ts`, settings view component |
| F3 | `loudnessService` + store mutations | new service, `projectStore.ts` |
| F4 | Playback: `applyPlaybackEffects`, gain on load | `applyDefaultPlaybackEffects.ts`, `playbackStoreCore.ts`, `playerAudioStore` |
| F5 | `DynamicsCompressorNode` + `setCompressionEnabled` | `WebAudioPlaybackEngine.ts`, `effects.ts` |
| F6 | Session-start gate (first 3 active) | `usePlayerSession.ts`, progress modal component |
| F7 | Preparation batch button + progress | `PlayerViewContainer.tsx` / `PlayerHeader.tsx` |
| F8 | Track row loudness icon + info popover + single scan | `ProjectItemRow.tsx`, `PlayerTracksList.tsx` |
| F9 | Platform types + ipcService + web demo stub | `platform/types.ts`, `ipcService.ts`, `webDemoPlatform.ts` |
| F10 | Background scan on `addItem` / `addItems` | `projectStore.ts` |

### Documentation

| ID | Task | Key files |
|----|------|-----------|
| D1 | Playback effects chain (gain, compressor) | `docs/modules/audio/playback-layers.md` |
| D2 | IPC channel `audio:analyzeLoudness` | `docs/modules/services/ipc-service.md` |
| D3 | `.cherry` track `loudness` field | `docs/modules/services/project-service.md` |
| D4 | Android future note (scanner adapter only) | `docs/android-capacitor-brief.md` or `android_port_todo.md` cross-link |

### Suggested scheduler wave order

```
Wave 1 (foundation):  E1 → E2 → E3 → F1 → F9
Wave 2 (core logic):  F2 → F3 → F4 → F5
Wave 3 (UX):          F6 → F7 → F8
Wave 4 (quality):     E4 → D1–D4 → lint
```

---

## Follow-ups (out of scope for v1)

- Album-gain / album-level normalization mode.
- Per-project target LUFS override in `ProjectSettings`.
- Android scanner via `ffmpeg-kit` or Capacitor plugin.
- Limiter node as alternative to gain-only headroom.
- Re-scan all tracks when `algorithmVersion` bumps (migration prompt).
- Server-side loudness metadata sync for parties.

---

## Key codebase touchpoints

| Area | Path |
|------|------|
| Track model | `CherryPlayList/src/core/types/track.ts` |
| Project persistence | `CherryPlayList/src/shared/services/projectService.ts` |
| Audio IPC (pattern) | `CherryPlayList/electron/ipc/audio.ts` |
| Playback engine | `CherryPlayList/src/shared/audio/playback/WebAudioPlaybackEngine.ts` |
| Effects / gain | `CherryPlayList/src/shared/audio/playback/effects.ts`, `applyDefaultPlaybackEffects.ts` |
| Load track flow | `CherryPlayList/src/shared/stores/playbackStoreCore.ts` |
| Session start | `CherryPlayList/src/workspaces/player/hooks/usePlayerSession.ts` |
| Track rows | `CherryPlayList/src/shared/components/rows/ProjectItemRow.tsx` |
| App settings | `CherryPlayList/src/shared/stores/settingsStore.ts` |
| Platform channels | `CherryPlayList/src/shared/platform/types.ts` |
