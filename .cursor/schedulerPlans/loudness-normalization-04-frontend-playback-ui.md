# Subtask 04 — Playback integration, compression, and player UI

## Type

**Frontend**

## Project

CherryPlayList (`CherryPlayList/`)

## Dependencies

- [loudness-normalization-03-frontend-foundation.md](./loudness-normalization-03-frontend-foundation.md) — `loudnessService`, settings, store mutations, platform contract.

## Scope

Wire loudness into the Web Audio playback chain, add optional compression, implement session-start gate, preparation batch scan UI, track-row loudness affordances, and settings UI section. Supersede the `setAutoGainEnabled` placeholder when loudness normalization is enabled.

### Deliverables

1. **Playback effects on track load**
   - Replace or extend `applyDefaultPlaybackEffects` with `applyPlaybackEffects(engine, track, settings)`:
     - Call `resolveLinearGain(track, settings)` → `engine.setTrackGain(linear)`.
     - Apply EQ defaults.
     - Wire compression toggle from settings.
   - Integrate in `playbackStoreCore` / `playerAudioStore` load-track flow.
   - When scan completes for current track, re-apply gain if still playing that track.
   - Supersede placeholder autogain in `effects.ts` — do not run when loudness normalization enabled.

2. **DynamicsCompressorNode** (`WebAudioPlaybackEngine`)
   - Add optional compressor in graph (recommend: after EQ, before master gain).
   - `setCompressionEnabled(enabled: boolean)` on `PlaybackEffects`.
   - Conservative v1 defaults: threshold −24 dB, ratio 4:1, knee 30, attack 0.003, release 0.25.
   - Bypass/disconnect when off.

3. **Settings UI**
   - Section in app settings (audio/device area):
     - Enable loudness normalization (master toggle).
     - Target LUFS (number input, default −18).
     - Enable compression (toggle).
   - When disabled: hide scan UI (subtask coordinates with track/session UI), gain always 1, compressor off.

4. **Preparation batch UI**
   - Button «Рассчитать нормализацию» in player preparation area (`PlayerViewContainer` / `PlayerHeader`).
   - Scans all project tracks needing scan via `loudnessService.scanTracks`.
   - Progress: count + current file name; per-track errors do not abort batch.

5. **Session-start gate** (`usePlayerSession`)
   - Before `startSession()` + `loadPlayerTrack`:
     - Identify **active** tracks in **playlist order** (same semantics as `isTrackActive` in `PlayerViewContainer`: not disabled, not in disabled group, not in `playedTrackIds`).
     - Take the **first 3 active** tracks (or all if fewer than 3 active).
     - Session start is blocked until each of those tracks has `status === 'ok'` — scan any that `needsScan`, showing blocking progress UI; cancel ⇒ abort session start.
   - Feature disabled ⇒ no gate, immediate start.
   - During session: only background scan for newly added tracks (from subtask 03 hook).

6. **Track row UI**
   - Always-visible loudness icon on track rows when feature enabled (`ProjectItemRow` / `PlayerTracksList` / `PlaylistView`).
   - States: ok, pending (spinner), unscanned, error.
   - Click → popover/modal: integrated LUFS, true peak, applied gain (dB), scan time, error message.
   - Action «Сканировать» for unscanned/stale/error single track.
   - Hidden when feature disabled in settings.

7. **Lint**
   - Run `cd CherryPlayList && npm run lint:fix` after all TS/TSX changes.

## Checklist

- [ ] Track with `status: 'ok'` and feature enabled applies `setTrackGain(linear)` on load.
- [ ] Feature disabled ⇒ `setTrackGain(1)` always; compressor off.
- [ ] Error/missing loudness ⇒ gain 1 (no throw); session gate still applies on start.
- [ ] Compression toggle affects graph on next `loadTrack`.
- [ ] «Рассчитать нормализацию» batch scans with progress; errors per track don't stop batch.
- [ ] Session start waits until first 3 **active** tracks in playlist order all have `status === 'ok'` (scan if needed); cancel aborts start.
- [ ] Session start immediate when those tracks are already `status === 'ok'` or feature disabled.
- [ ] Track row icon + popover + single-track scan; hidden when feature disabled.
- [ ] Placeholder autogain not active when loudness normalization enabled.
- [ ] `npm run lint:fix` passes with no errors.
- [ ] **No edits** to pre-existing test files.

## Files to touch

| Area | Path |
|------|------|
| Playback effects | `CherryPlayList/src/shared/audio/playback/applyDefaultPlaybackEffects.ts` |
| Effects / autogain | `CherryPlayList/src/shared/audio/playback/effects.ts` |
| Playback engine | `CherryPlayList/src/shared/audio/playback/WebAudioPlaybackEngine.ts` |
| Load track flow | `CherryPlayList/src/shared/stores/playbackStoreCore.ts` |
| Player audio store | `CherryPlayList/src/shared/stores/playerAudioStore.ts` |
| Session start | `CherryPlayList/src/workspaces/player/hooks/usePlayerSession.ts` |
| Player shell | `CherryPlayList/src/workspaces/player/PlayerViewContainer.tsx` |
| Player header | `CherryPlayList/src/workspaces/player/PlayerHeader.tsx` (or equivalent) |
| Track rows | `CherryPlayList/src/shared/components/rows/ProjectItemRow.tsx` |
| Track lists | `CherryPlayList/src/workspaces/player/PlayerTracksList.tsx`, playlist views as needed |
| Settings view | App settings audio section component (locate via settings workspace) |
| Progress UI (new) | Modal/component for scan progress (new file under `src/shared/components/` or player workspace) |
| Loudness popover (new) | Track loudness info popover component (new) |

## Acceptance criteria mapping

- AC2 (playback gain)
- AC4 (preparation batch)
- AC5 (session start gate)
- AC6 (runtime track add — playback re-apply after scan)
- AC7 (track row UI)
- AC8 (compression)
- AC10 (lint)
