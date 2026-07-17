# Subtask 05 — CherryPlayList documentation updates

## Type

**Documentation**

## Project

CherryPlayList docs (`CherryPlayList/docs/`)

## Dependencies

- [loudness-normalization-02-electron-scanner.md](./loudness-normalization-02-electron-scanner.md)
- [loudness-normalization-03-frontend-foundation.md](./loudness-normalization-03-frontend-foundation.md)
- [loudness-normalization-04-frontend-playback-ui.md](./loudness-normalization-04-frontend-playback-ui.md)

Run after implementation stabilizes so docs match final behavior (graph order, IPC payload, field names).

## Scope

Update CherryPlayList module documentation for the loudness normalization feature: playback chain, IPC channel, `.cherry` track schema, and a brief Android future note. Do **not** add docs under repo root `docs/` unless cross-linking from existing Android port material.

### Deliverables

1. **Playback effects chain**
   - Document per-track gain from loudness metadata, headroom policy, and optional `DynamicsCompressorNode` placement in the Web Audio graph.
   - Note that `WebAudioPlaybackEngine` receives linear gain only (no LUFS parsing in engine).
   - Document superseding of placeholder autogain when normalization is enabled.

2. **IPC channel**
   - Document `audio:analyzeLoudness`: request payload (path, `targetLufs`), response shape, error policy, security (path validation).

3. **`.cherry` track schema**
   - Document optional `loudness` field on saved tracks: fields, `status` values, staleness via `fileMtime`, `algorithmVersion`.

4. **Android / Capacitor future**
   - Short note: renderer store and `.cherry` schema shared; only `analyzeLoudness` platform adapter changes (e.g. `ffmpeg-kit`).
   - Cross-link `android_port_todo.md` at repo root if appropriate.

5. **Module index**
   - Update `CherryPlayList/docs/modules/README.md` or audio hub if new sections are added.

## Checklist

- [ ] `playback-layers.md` describes track gain node, compressor toggle, and load-time `applyPlaybackEffects` flow.
- [ ] `ipc-service.md` documents `audio:analyzeLoudness` contract.
- [ ] `project-service.md` documents `track.loudness` in `.cherry`.
- [ ] Android future note added or cross-linked.
- [ ] Docs consistent with technical spec AC1–AC9 behavior.
- [ ] No contradiction with [CONTRACTS.md](../../CONTRACTS.md) or [CherryPlayList/FULL_DOCUMENTATION.md](../../CherryPlayList/FULL_DOCUMENTATION.md) — fix or note if drift found.

## Files to touch

| Area | Path |
|------|------|
| Playback chain | `CherryPlayList/docs/modules/audio/playback-layers.md` |
| IPC | `CherryPlayList/docs/modules/services/ipc-service.md` |
| Project persistence | `CherryPlayList/docs/modules/services/project-service.md` |
| Module hub | `CherryPlayList/docs/modules/README.md` (if needed) |
| Android cross-link | `android_port_todo.md` (repo root) — brief addition or link only |
| Optional | `CherryPlayList/docs/android-capacitor-brief.md` (if exists) |

## Acceptance criteria mapping

- Supports AC10 (quality gates) documentation aspect.
- Enables future Android port work to reuse schema without re-reading implementation.
