# Plan — Loudness normalization (CherryPlayList)

## Task summary

Implement **non-destructive loudness normalization** for CherryPlayList (Electron desktop): measure each track's integrated loudness (LUFS) and true peak via FFmpeg `ebur128`, persist results in the project (`.cherry`), and apply per-track gain at playback time through the existing Web Audio chain. Original audio files on disk are never modified.

**Scope:** CherryPlayList only — Electron main process scanner, renderer store/service/UI, and module documentation. No CherryPlayServer (.NET) changes.

**Specification:** [loudness-normalization-01-technical-spec.md](./loudness-normalization-01-technical-spec.md)  
**Context:** [loudness-normalization-00-chat-summary.md](./loudness-normalization-00-chat-summary.md)

## Subtasks (4)

| Step | File | Type | Summary |
|------|------|------|---------|
| 1 | [loudness-normalization-02-electron-scanner.md](./loudness-normalization-02-electron-scanner.md) | Desktop/Electron | `ffmpeg-static`, scanner, `analyzeLoudness` + `statAudioFile` IPC, bundling, parser tests |
| 2 | [loudness-normalization-03-frontend-foundation.md](./loudness-normalization-03-frontend-foundation.md) | Frontend | Data model, settings, platform contract, loudness service, store, required gain/needsScan tests |
| 3 | [loudness-normalization-04-frontend-playback-ui.md](./loudness-normalization-04-frontend-playback-ui.md) | Frontend | Playback gain/compression, session gate, batch + track UI |
| 4 | [loudness-normalization-05-documentation.md](./loudness-normalization-05-documentation.md) | Documentation | CherryPlayList audio/IPC/project docs + Android note |

## Execution waves

```
Wave 1:  02-electron-scanner          (no dependencies)
Wave 2:  03-frontend-foundation       (depends on 02 for IPC integration testing)
Wave 3:  04-frontend-playback-ui      (depends on 03)
Wave 4:  05-documentation             (depends on 02–04; run after implementation stabilizes)
```

## Worker routing

| Subtask | Worker |
|---------|--------|
| 02 | `worker-electron` (+ parser unit tests in new test file only) |
| 03, 04 | `worker-frontend` |
| 05 | `worker-documentation` |

## Global constraints

- Do **not** edit pre-existing test files unless the user explicitly confirms (workspace rule).
- New unit tests: parser (`tests/electron/loudnessScanner.test.ts`, subtask 02) and gain resolver + `needsScan` (`tests/shared/services/loudnessService.test.ts`, **required** in subtask 03).
- Run `CherryPlayList` `npm run lint:fix` after TS/TSX changes in subtasks **03 and 04**.
- AC3 staleness: `audio:statAudioFile` IPC (subtask 02) → platform contract (subtask 03) → `needsScan` compares `fileMtime` vs `mtimeMs`.
- Fail open at playback: gain = 1 on error/missing loudness; session-start gate is the only blocking UX.
- Target loudness default **−18 LUFS**; `algorithmVersion: 1`.

## Acceptance criteria (rollup)

See technical spec sections **AC1–AC10**. Each subtask file maps to a subset; full end-to-end pass requires all four subtasks complete.

## Out of scope (v1)

Album-gain mode, destructive normalization, Android scanner, server-side sync, limiter node, per-project LUFS override, algorithmVersion migration prompt.
