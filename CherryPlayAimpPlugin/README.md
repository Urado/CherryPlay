# CherryPlayAimpPlugin

Native Windows x64 **AIMP bridge** plugin for CherryPlayList. Streams AIMP playlist and playback state over a **named pipe** using a **NDJSON** (newline-delimited JSON) protocol. The plugin is **read-only**: it observes AIMP and streams to CherryPlayList; it does not control playback or modify playlists.

## Scope

- Implements `IAIMPPlugin` as a lightweight read-only bridge.
- Observes AIMP playlist and playback state.
- Sends newline-delimited UTF-8 JSON (one object per line) to `\\.\pipe\cherryplay-aimp-v1`.
- Publishes: `hello`, `playlistSnapshot`, `playbackSnapshot`, `heartbeat`, `goodbye`. CherryPlayList responds with `helloAck` after `hello` before the plugin streams snapshots.
- Waits for the server `helloAck` compatibility response before streaming snapshots.
- Reconnects automatically when CherryPlayList restarts its named-pipe server.
- Does not implement CherryPlay business logic or remote control commands.

## Project layout

- `CMakeLists.txt` - standalone native build.
- `CMakePresets.json` - ready-to-use VS 2022 x64 presets.
- `src/CherryPlayAimpPlugin.cpp` - plugin implementation.
- `samples/*.ndjson` - reference NDJSON protocol transcripts; full-session samples include the server-emitted `helloAck` frame between plugin-emitted messages.
- `docs/AIMP_PLAYLIST_PLAYBACK_ANALYSIS.md` - analysis of playlist/playback semantics, main-thread requirements, and track consistency (historical; the plugin now uses main-thread snapshot collection when `IAIMPServiceThreads` is available).

## Requirements

- Windows x64.
- Visual Studio 2022 or 2026 with Desktop C++ workload (or Build Tools).
- CMake 3.25+.
- **AIMP SDK** — исходники (headers) должны быть доступны. По умолчанию плагин ожидает путь `D:\AIMP_SDK\Sources\Cpp`. Если SDK у вас в другом месте, задайте при конфигурации CMake: `-DAIMP_SDK_ROOT="C:/path/to/Sources/Cpp"`.
- AIMP x64 установлен локально для проверки в рантайме.

## Build

### Using CMake presets

Default (VS 2026):

```powershell
cmake --preset vs2026-x64-release
cmake --build --preset build-release
```

For Visual Studio 2022:

```powershell
cmake --preset vs2022-x64-release
cmake --build --preset build-release-vs2022
```

### Using explicit commands

```powershell
cmake -S CherryPlayAimpPlugin -B CherryPlayAimpPlugin/build/manual -G "Visual Studio 17 2022" -A x64 -DAIMP_SDK_ROOT="D:/AIMP_SDK/Sources/Cpp"
cmake --build CherryPlayAimpPlugin/build/manual --config Release
```

Use `Visual Studio 18 2026` and `-G "Visual Studio 18 2026"` if you have VS 2026.

The build output DLL is `CherryPlayAimpBridge.dll` (under `build/<preset>/Release/` or `.../Debug/`).

## Install / Установка в AIMP

1. **Собрать** плагин (Release x64) — см. раздел Build выше. Итоговый файл: `build/<preset>/Release/CherryPlayAimpBridge.dll`.
2. **Найти папку Plugins AIMP x64**, например:
   - `C:\Program Files\AIMP\Plugins`
   - или каталог установки AIMP → подпапка `Plugins`.
   - Должна использоваться установка **AIMP x64**, не 32-битная.
3. **Скопировать** `CherryPlayAimpBridge.dll` в эту папку (при необходимости — с правами администратора).
4. **Перезапустить AIMP** (полностью закрыть и открыть снова).
5. В **CherryPlayList**: убедиться, что в настройках выбран источник **AIMP** и присутствует манифест `CherryPlayList/plugins/CherryPlayAimpBridge/manifest.json`, чтобы приложение слушало pipe `\\.\pipe\cherryplay-aimp-v1`. После запуска AIMP в панели AIMP должно отображаться состояние «подключён».

## Protocol

**Message types (plugin → CherryPlayList):** `hello`, `playlistSnapshot`, `playbackSnapshot`, `heartbeat`, `goodbye`. **Server → plugin:** `helloAck` (after `hello`, before snapshots).

- **Transport:** one UTF-8 JSON object per line (NDJSON). Duplex: plugin writes to the pipe; CherryPlayList may send `helloAck` (and the plugin reads it to detect protocol mismatch).
- **Throttling:** playback snapshots are sent at most once every **500 ms** (minimum interval). Playlist snapshots are sent on change; heartbeat at a fixed interval (e.g. 5 s). This avoids flooding the pipe when position updates are frequent.
- **Threading:** snapshot collection (reading AIMP playlist/player API) runs on the **main thread** when `IAIMPServiceThreads` is available (via `ExecuteInMainThread`), so AIMP SDK calls are made from the correct thread. A dedicated **transport thread** writes to the pipe and never blocks the main thread or AIMP UI.
- CherryPlayList answers the initial `hello` with `helloAck` so the plugin can distinguish protocol mismatch from a normal reconnect.
- The sample `.ndjson` files model full duplex sessions; `helloAck` appears as a server-emitted frame between the plugin's `hello` and later plugin frames.
- **Track identity (Step 1 contract):** `nativeTrackId` when AIMP exposes a usable key, else `filePath` when available, else `title + durationMs` fallback. Each playlist entry has a `trackKey`; the same file can appear multiple times (duplicate keys possible). There is a **single active track** (playlist cursor) and a **single current track** (playing item).
- The plugin observes the **active playlist** first and falls back to the **playing playlist** when AIMP does not expose an active one. Playlist `activeTrack`/`activeTrackKey` come from the active playlist cursor, not from switching the snapshot to the playing playlist.
- If the currently playing track is **not** in the observed playlist, the plugin keeps playback status but **omits** `currentTrack`/`currentTrackKey` so playlist/playback consistency holds.

## Assumptions

- `AIMP_FILEINFO_PROPID_KEY` is treated as the closest available native per-track identifier when present.
- If AIMP does not provide a duration for a title-only fallback identity, the plugin emits `durationMs: 0` so the message remains contract-valid.
- The named pipe is opened as duplex so the plugin can read a minimal `helloAck` acceptance or rejection from CherryPlayList before streaming snapshots.
- When CherryPlayList restarts and closes the pipe, the plugin observes transport loss and starts a fresh session with a new `hello`; there is no restart-specific `goodbye` frame in that path.

## Manual verification

1. Start CherryPlayList and switch the streaming source to `AIMP`.
2. Confirm the Electron app is listening on `\\.\pipe\cherryplay-aimp-v1`.
3. Start AIMP x64 with the plugin installed.
4. Verify CherryPlayList accepts the initial `hello` and answers with `helloAck`.
5. Verify the first plugin-emitted snapshot sequence is `hello`, then `playlistSnapshot`, then `playbackSnapshot`.
6. Change tracks or playlists in AIMP and verify fresh snapshots arrive without callback-thread stalls.
7. Leave playback idle and confirm periodic `heartbeat` messages continue every 5 seconds.
8. Restart CherryPlayList and verify the plugin reconnects automatically by opening a fresh session that starts with a new `hello`.
9. Close AIMP and verify a `goodbye` frame is sent with `appClosing` when shutdown timing allows.
