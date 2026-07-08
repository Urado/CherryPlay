# CherryPlayList --- Full Technical Documentation

This documentation is designed explicitly for ingestion by an LLM during
application development.\
It is verbose, explicit, strictly structured, and modular.

---

# 1. Project Overview

CherryPlayList is a desktop application intended for **personal DJ
workflow optimization**.\
Its main purpose is fast creation and organization of playlists using
**drag‑and‑drop**, manual ordering, and exporting files in a consistent
order.\
The app works **offline**, operates directly on local audio files, and
is built with:

- **Electron** (desktop shell)
- **React + TypeScript** (UI)
- **Zustand** (state management)
- **localforage** (asynchronous storage via IndexedDB for reliable state persistence)
- **Local JSON storage**
- **Extensible plugin-based architecture**

The application does **not modify the source audio files**, ensuring
full safety for the music library.

---

# 2. Core Use Cases

## 2.1 Primary User Flow

1.  Open app.
2.  Create new playlist.
3.  Browse files (via built-in File Explorer or other sources).
4.  Drag tracks into playlist.
5.  Reorder tracks manually by dragging.
6.  Export playlist:
    - copy files into a folder
    - rename with sortable numeric prefixes

## 2.2 Secondary User Flows

- Load existing saved playlist.
- Add tracks by dragging files directly from OS file explorer.
- Combine tracks from different folders.
- Quickly access toolbox panels (File Explorer, future modules,
  plugins).
- Save playlist JSON for later reuse.
- Use future smart panels: history, tagged DB, metadata search,
  plugins.

---

# 3. Architecture Overview

The system is separated into **three main layers**:

    ┌──────────────────────────────┐
    │          UI Layer            │ React + TS
    │ - Components                 │ Zustand UI state
    │ - Views/Layouts              │
    └───────────────┬──────────────┘
                    │
    ┌───────────────▼──────────────┐
    │     Application Layer         │
    │ - Playlist manager            │
    │ - Export system               │
    │ - Track sources API           │
    │ - Plugin manager              │
    │ Zustand global state stores   │
    └───────────────┬──────────────┘
                    │ IPC
    ┌───────────────▼──────────────┐
    │        Electron Layer         │
    │ - File operations             │
    │ - FS-safe copying/renaming    │
    │ - Plugin sandbox loading       │
    │ - System dialogs              │
    └───────────────────────────────┘

---

# 4. Architecture Diagrams (Mermaid)

## 4.1 High-Level Component Diagram

The architecture consists of three layers: React UI Layer interacts with Application Logic Layer, which in turn communicates with Electron Main Process via IPC. Both layers use Zustand Stores for state management. Electron Main Process interacts with File System and Plugin Loader.

## 4.2 Playlist Creation Workflow

User drags files onto the playlist. UI calls addTrack in the store, which validates and formats track objects. After that, UI visually updates the playlist.

## 4.3 Export Workflow

User initiates playlist export. UI calls executeExport in ExportService, which sends an IPC request to the Electron process. Electron copies and renames files in the file system, then returns the result to UI.

---

# 5. Detailed Module Structure

    project-root/
    ├── electron/
    │   ├── main.ts               # App entry
    │   ├── ipc/                  # All IPC channels
    │   │   ├── export.ts
    │   │   ├── fileBrowser.ts
    │   │   ├── audio.ts
    │   │   ├── dialogs.ts
    │   │   ├── playlist.ts
    │   │   └── system.ts
    │   └── utils/                # FS helpers
    │
    ├── src/
    │   ├── app/                  # Application-level components
    │   │   ├── App.tsx
    │   │   ├── WorkspaceRenderer.tsx
    │   │   └── components/       # App-level components (Header, Footer, Modals)
    │   ├── core/                 # Core types, interfaces, constants
    │   │   ├── types/
    │   │   ├── interfaces/
    │   │   ├── constants/
    │   │   └── registry/         # Workspace module registry
    │   ├── shared/               # Shared components, services, stores
    │   │   ├── components/
    │   │   ├── services/
    │   │   ├── stores/           # Zustand stores
    │   │   ├── hooks/            # includes useWindowMinSize.ts (layout viewport + Electron min window)
    │   │   └── utils/            # layoutWorkspaceMins.ts, layoutViewportBridge.ts, layoutWorkspaceOperations.ts, …
    │   ├── workspaces/           # Workspace modules (isolated)
    │   │   ├── playlist/
    │   │   ├── collection/
    │   │   ├── fileBrowser/
    │   │   └── testZone/
    │   ├── components/           # General components (FileBrowser, SourcesPanel)
    │   ├── modules/              # Modules (dragDrop)
    │   ├── types/                # Additional types
    │   └── index.tsx
    │
    ├── plugins/                  # External plugin root folder
    └── public/

## 5.1 Demo Player Module

The demo player is a lightweight audio preview pipeline located in the application header. It does not replace a full queue/playlist player; instead, it plays a single track on demand for quick checks.

### Responsibilities

- Hold a single `HTMLAudioElement` instance that survives workspace switches.
- React to play button clicks originating from any workspace (playlist, collection, future types).
- Track playback metadata: format support relies on Chromium’s audio stack (MP3, WAV, FLAC, M4A, OGG tested).
- Surface actionable UI state (current track, status, timecodes, errors) through a dedicated Zustand store.
- Provide utilities for revealing the current track inside FileBrowser.

### Components

1. **demoPlayerStore** — orchestrates the audio element, exposes actions (`loadTrack`, `play`, `pause`, `seek`, `setVolume`, etc.), stores `position`, `duration`, `volume`, `status`, and `sourceWorkspaceId`.
2. **DemoPlayer component** — rendered at the top of `AppHeader`; shows title, "Show in browser" button, play/pause toggle, timeline slider with live position, and volume slider. The component receives data through `useDemoPlayerController` (can be substituted in tests), validates the path before calling "Show in browser" and cleans up store resources on unmount.
3. **Playlist/Collection buttons** — every track row owns a play button that calls `demoPlayerStore.loadTrack(track, workspaceId)` followed by `play()`.
4. **FileBrowser bridge** — action in `uiStore` focuses the originating file path when the header button is pressed.

---

# 6. Zustand Stores (Deep Specification)

## 6.1 projectStore (Primary Data Store)

**Location**: `src/shared/stores/projectStore.ts`

The central store for all project data. After the workspace refactoring, this store replaces the separate `playlistStore` and `playerItemsStore`, providing a unified data source for both Playlist and Player views.

### State

```typescript
{
  // Core data
  name: string                           // Project name
  items: ProjectItem[]                   // Tracks and groups (hierarchical structure)
  settings: ProjectSettings              // Global project settings
  trackSettings: Map<string, ProjectTrackSettings>   // Per-track settings
  groupSettings: Map<string, ProjectGroupSettings>   // Per-group settings
  sessionState: ProjectSessionState      // Session state (mode, played tracks, etc.)
  meta: ProjectMeta                      // File path, isDirty flag, lastSavedAt

  // UI state (not saved to file)
  selectedItemIds: Set<string>           // Selected item IDs

  // Undo/Redo history
  history: ProjectHistoryAction[]        // Action history
  historyIndex: number                   // Current position in history
  _skipHistory: boolean                  // Internal flag to skip history recording
}
```

### Project Items

The `items` array contains `ProjectItem` objects, which can be either tracks or groups:

```typescript
type ProjectItem = Track | ProjectGroup;

interface ProjectGroup {
  id: string;
  name: string;
  items: ProjectItem[]; // Nested items (recursive structure)
}
```

### Actions: Project Management

- `setName(name)` - Set project name
- `newProject()` - Create new empty project (resets history)
- `loadProject(data)` - Load project from file (resets history)
- `setFilePath(path)` - Set file path for quick save
- `markAsDirty()` - Mark project as having unsaved changes
- `resetDirty()` - Reset dirty flag after save

### Actions: Items

- `addItem(item, index?)` - Add single track
- `addItems(items, index?)` - Add multiple tracks
- `removeItem(id)` - Remove item by ID
- `moveItem(fromIndex, toIndex)` - Move item within list
- `findItemById(id)` - Find item by ID (recursive)
- `findItemIndex(id)` - Find root-level index
- `getAllTracksInOrder(items?)` - Get flat list of all tracks
- `getItemPath(itemId)` - Get path to item (array of IDs)
- `updateTrackDuration(id, duration)` - Update track duration

### Actions: Groups

- `createGroup(itemIds, name?)` - Create group from consecutive items
- `ungroupGroup(groupId)` - Dissolve group, keeping items
- `removeGroup(groupId)` - Remove group and all contents
- `setGroupName(groupId, name)` - Rename group
- `addItemToGroup(groupId, itemId, index?)` - Add item to group
- `removeItemFromGroup(groupId, itemId)` - Remove item from group
- `moveItemInGroup(groupId, fromIndex, toIndex)` - Reorder within group

### Actions: Selection

- `selectItem(id)` / `deselectItem(id)` - Select/deselect single item
- `toggleItemSelection(id)` - Toggle selection
- `selectAll()` / `deselectAll()` - Select/deselect all
- `selectRange(fromId, toId)` - Select range
- `removeSelectedItems()` - Remove all selected
- `moveSelectedItems(toIndex)` - Move all selected

### Actions: Undo/Redo

- `undo()` - Undo last action
- `redo()` - Redo last undone action
- `canUndo()` - Check if undo is available
- `canRedo()` - Check if redo is available

Supported actions in history:

- Add/remove items
- Move items
- Create/ungroup groups
- Rename groups
- Rename project

### Actions: Settings

- `setDefaultPauseBetweenTracks(value)` - Set default pause
- `setDefaultActionAfterTrack(value)` - Set default action ('next', 'pause', 'pauseAndNext')
- `setPlannedEndTime(time)` - Set planned end time
- `setTrackSettings(trackId, settings)` / `getTrackSettings(trackId)` / `clearTrackSettings(trackId)`
- `setGroupSettings(groupId, settings)` / `getGroupSettings(groupId)` / `clearGroupSettings(groupId)`

### Actions: Session

- `startSession()` - Switch to session mode
- `resetSession()` - Reset to preparation mode
- `markTrackAsPlayed(trackId)` - Mark track as played
- `setCurrentTrack(trackId)` - Set current playing track
- `isTrackPlayed(trackId)` - Check if track was played
- `toggleTrackDisabled(trackId)` / `isTrackDisabled(trackId)` - Disable/enable track
- `toggleGroupDisabled(groupId)` / `isGroupDisabled(groupId)` - Disable/enable group

### Persistence

The store uses `electronStorage` (localforage/IndexedDB) for persistence. History is not persisted - it resets on app restart or project load.

---

## 6.1.1 playlistStore (Deprecated)

> **Note**: `playlistStore` has been replaced by `projectStore`. Collections still use `trackWorkspaceStoreFactory` for their separate stores.

---

## 6.2 uiStore

Handles interface operations and global workspace management.

### State

    {
      activeSource: 'fileBrowser' | 'playlists' | 'db'
      modal: null | { type: string, payload: any }
      notifications: Notification[]
      dragging: boolean
      draggedItems: DraggedItems | null  // Global state for drag-and-drop operations
      fileBrowserFocusRequest: { path: string; timestamp: number } | null  // Request to focus file in browser
      workspaces: WorkspaceInfo[]  // List of all registered workspaces
      activeWorkspaceId: WorkspaceId | null  // Currently active workspace
    }

### Workspace Management

The `uiStore` manages a global registry of all workspaces in the application. Each workspace has:

- `id: WorkspaceId` - Unique identifier (UUID)
- `type: WorkspaceType` - Type of workspace ('playlist', 'collection', 'fileBrowser', etc.)
- `name: string` - Display name
- `zoneId?: string` - Associated layout zone ID

### Global Drag State

The `draggedItems` state is stored globally in `uiStore` to enable cross-workspace drag-and-drop operations. It can be:

- `{ type: 'tracks'; ids: Set<string>; sourceWorkspaceId: WorkspaceId }` - Dragged tracks from a workspace
- `{ type: 'files'; paths: string[] }` - Dragged files from file browser
- `null` - No active drag operation

### File Browser Focus

The `fileBrowserFocusRequest` state is used to request focusing a specific file in the FileBrowser component. When set, it contains:

- `path: string` - Path to the file that should be focused
- `timestamp: number` - Timestamp when the request was made (used to detect new requests)

**Methods:**

- `focusFileInBrowser(path: string)` - Requests focus on a file in FileBrowser. Sets `activeSource` to 'fileBrowser' and creates a focus request.
- `acknowledgeFileBrowserFocus()` - Clears the focus request after it has been processed by FileBrowser component.

---

## 6.3 dragDropStore

**Location**: `src/shared/stores/dragDropStore.ts`

Centralized store for managing cross-workspace drag-and-drop operations. This store is **completely workspace-agnostic** - it works with any track-based workspace registered via `trackWorkspaceStoreFactory`, without hardcoded dependencies on specific workspace types (playlists, collections, etc.).

### Purpose

The `dragDropStore` decouples drag-and-drop logic from individual workspace components, providing a single point of control for all cross-workspace operations. This ensures consistent behavior across all workspace types and makes the system fully extensible - new workspace types automatically work with drag-and-drop without code changes.

**Key Design Principles:**

- **Workspace Independence**: No hardcoded references to specific workspace types
- **ID-Based Lookup**: Uses `getTrackWorkspaceStore(workspaceId)` to find stores dynamically
- **Validation**: Checks workspace existence and track limits before operations
- **Error Handling**: Provides user notifications on failures

### Methods

`moveTracksBetweenWorkspaces` - moves tracks between workspaces. Accepts an array of track IDs, source and target workspace IDs, and an optional insertion index. Returns true on success, false on error.

`copyTracksBetweenWorkspaces` - copies tracks between workspaces. Accepts the same parameters as moveTracksBetweenWorkspaces. Returns true on success, false on error.

### Implementation Details

1. **Store Lookup**: Uses `getTrackWorkspaceStore(workspaceId)` from `trackWorkspaceStoreFactory` to retrieve source and target stores by workspace ID. This is completely dynamic - no hardcoded workspace types.
2. **Validation**:
   - Checks that both source and target stores exist (returns false and shows notification if not)
   - Validates track limits using `canAddTracks()` helper function
   - Handles unlimited workspaces (`maxTracks: null`) correctly
3. **Move Operation**:
   - Retrieves tracks from source store by track IDs
   - Validates target store capacity
   - Adds tracks to target store (at specified index or end)
   - Removes tracks from source store
   - Wrapped in try-catch for error handling
4. **Copy Operation**:
   - Retrieves tracks from source store by track IDs
   - Creates new track objects (without IDs, new IDs generated by target store)
   - Validates target store capacity
   - Adds tracks to target store (at specified index or end)
   - Source tracks remain unchanged
   - Wrapped in try-catch for error handling

### Usage

The store is used through the `useDragDropStore()` hook. Methods `moveTracksBetweenWorkspaces` and `copyTracksBetweenWorkspaces` are called with an array of track IDs, source and target workspace IDs, and an optional insertion index. For copying, the `copyTracksBetweenWorkspaces` method is used, which creates new track objects with new IDs.

---

## 6.4 trackWorkspaceStoreFactory

**Location**: `src/shared/stores/trackWorkspaceStoreFactory.ts`

Factory for creating and managing Zustand stores for track-based workspaces (playlists, collections, etc.). This factory ensures consistent store structure and provides centralized registration for cross-workspace operations.

### Purpose

- **Unified Store Structure**: All track-based workspaces use the same store interface
- **Centralized Registration**: All stores are registered in a global map for discovery by `dragDropStore`
- **History Management**: Built-in undo/redo support with configurable history depth
- **Track Limits**: Configurable maximum track limits per workspace

### Functions

`ensureTrackWorkspaceStore(options)` - creates or retrieves an existing store for a workspace. Accepts options with workspaceId, initialName, maxTracks, and historyDepth.

`getTrackWorkspaceStore(workspaceId)` - retrieves a store by workspace ID. Returns the store or undefined if not found.

`registerTrackWorkspaceStore(workspaceId, store)` - registers an existing store (used for the main playlist).

`getAllTrackWorkspaceStores()` - returns all registered stores (for debugging).

### Store Options

Options for creating a store include: `workspaceId` (unique identifier), `initialName` (initial name, default 'New Workspace'), `maxTracks` (maximum number of tracks, null = unlimited, default null), `historyDepth` (undo/redo history depth, default 50).

### Store Interface

All stores created by the factory implement `TrackWorkspaceState`, which includes:

- Track management: `addTrack`, `addTracks`, `addTracksAt`, `removeTrack`, `moveTrack`
- Selection: `selectTrack`, `deselectTrack`, `selectAll`, `deselectAll`, `toggleTrackSelection`, `selectRange`
- Batch operations: `removeSelectedTracks`, `moveSelectedTracks`
- History: `undo`, `redo`, `canUndo`, `canRedo`
- Metadata: `setName`, `updateTrackDuration`

### Usage Example

To create a collection store, `ensureTrackWorkspaceStore()` is used with options: workspaceId, initialName, maxTracks (null for unlimited), historyDepth. The store returns an object with methods for working with tracks: tracks, addTrack, removeTrack, and others.

---

## 6.5 settingsStore

Handles app preferences including UI customization and export settings.

### State

    {
      exportPath: string
      exportStrategy: 'copyWithNumberPrefix' | 'aimpPlaylist'
      lastOpenedPlaylist: string
      trackItemSizePreset: 'small' | 'medium' | 'large'
      hourDividerInterval: number
      showHourDividers: boolean
    }

### Default Values

- `exportPath: ''` - Empty string (user must select folder)
- `exportStrategy: 'copyWithNumberPrefix'` - Default export strategy
- `lastOpenedPlaylist: ''` - Empty string (no playlist loaded)
- `trackItemSizePreset: 'medium'` - Default size preset
- `hourDividerInterval: 3600` - 1 hour in seconds (default)
- `showHourDividers: true` - Dividers enabled by default

### Track Item Size Presets

- `small`: padding 8px, margin 2px
- `medium`: padding 12px, margin 4px (default)
- `large`: padding 16px, margin 6px

### Hour Divider Intervals

Common interval values (in seconds):

- `900` - 15 minutes
- `1800` - 30 minutes
- `3600` - 1 hour (default)
- `7200` - 2 hours
- `10800` - 3 hours

## 6.6 demoPlayerStore

Handles playback state for the demo audio player.

### State

State includes: `currentTrack` (Track or null), `sourceWorkspaceId` (WorkspaceId or null), `status` ('idle' | 'playing' | 'paused' | 'ended'), `position` (seconds, float), `duration` (seconds, float), `volume` (0..1), `error` (string or null).

Internal (non-serialized) members: `audioElement` (HTMLAudioElement, created lazily on the store side and handles ended/timeupdate/loadedmetadata/error events), `currentObjectUrl` (string or null, active object URL that is cleared when loading a new track or on clear()).

### Actions

Methods: `loadTrack(track, sourceWorkspaceId)` - loads a track, `play()` - plays, `pause()` - pauses, `seek(positionSeconds)` - seeks, `setVolume(value)` - sets volume, `setDuration(value)` - invoked on loadedmetadata, `handleEnded()` - resets status/position to ended state, `handleError(message)` - stores message and logs detailed error, `clear()` - stops playback, resets state and revokes current object URL.

### Behavior Notes

`loadTrack` always resets playback to the start; previous track is discarded and object URLs are revoked to avoid leaks. When playback finishes naturally, status switches to 'ended', and the play button restarts from the beginning. Errors contain concise text for notifications; the underlying Error object is logged via logger.error. Store emits Zustand subscriptions that keep the header player UI in sync with actual audio element events (timeupdate, loadedmetadata, ended, error).

---

## 6.7 Data Persistence (localforage)

**Location**: `src/shared/storage/electronStorage.ts`

All Zustand stores using `persist` middleware now use **localforage** (IndexedDB) instead of `localStorage` for reliable data persistence between application sessions, including during system sleep mode.

### Problem Solved

Previously, application state could be lost when the system entered sleep mode because `localStorage` in Electron may not persist data reliably during sleep or unexpected shutdowns. Additionally, `localStorage` is synchronous and blocks the UI thread, and has limited storage capacity (~5-10 MB).

### Solution: localforage

**localforage** provides:

- **Asynchronous storage** - does not block UI thread
- **Reliability** - data is persisted to disk, survives sleep mode and unexpected shutdowns
- **Larger practical quota than `localStorage`** — typically IndexedDB; exact limits depend on Chromium/Electron and available storage (not a fixed fraction of disk)
- **Structured data** — Zustand state is serialized to JSON via `electronStorage` for storage in localforage (plain serializable fields only; see each store’s `partialize`)
- **Automatic driver selection** - IndexedDB > WebSQL > localStorage

### Implementation

The `electronStorage` adapter implements Zustand’s `PersistStorage<unknown>`: values are **`JSON.stringify` / `JSON.parse`** of Zustand’s `StorageValue` (state + version metadata) on top of localforage string values. See `src/shared/storage/electronStorage.ts` for the exact implementation.

### Stores Using electronStorage

All stores with `persist` middleware use `electronStorage` (authoritative list is maintained in module docs):

- **authStore** — access token and organizer profile
- **settingsStore** — application settings (export, paths, audio devices, shortcuts, streaming flags, etc.)
- **layoutStore** — workspace zone tree and split layout
- **projectStore** — main playlist project (items, groups, session state, reduced meta including party id/shortCode where applicable)
- **ensureProjectStore** with `persist: true` — per-`workspaceId` projects (e.g. collections); persist key `cherryplaylist-<workspaceId>`

### Configuration

localforage is configured with:

```typescript
const storage = localforage.createInstance({
  name: 'CherryPlayList',
  storeName: 'app-storage',
  description: 'CherryPlayList application storage',
  driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
});
```

### Migration Notes

When upgrading to this version:

- Old data from `localStorage` is not automatically migrated
- New data will be stored in IndexedDB via localforage
- This is expected behavior - users can reload their playlists from saved files

For more details, see [Storage overview](docs/modules/systems/storage.md), [storage architecture](docs/modules/systems/storage-architecture.md), [persisted client state (keys and fields)](docs/modules/systems/persisted-client-state.md), and the «Хранение данных» section in [TECHNICAL.md](./TECHNICAL.md).

---

# 6.4 IPC Service

**Location**: `src/shared/services/ipcService.ts`

IPCService provides methods for interacting with Electron main process via IPC. All methods return promises and handle errors automatically, showing notifications on failure.

## Core Method

### `invoke<T>(channel: string, payload?: any, showNotification?: boolean): Promise<T>`

Generic method for IPC communication. All other methods use this internally.

- `channel` - IPC channel name (must be whitelisted in `electron/preload.ts`)
- `payload` - Optional data to send to main process
- `showNotification` - Whether to show error notification (default: `true`)
- Returns: Promise with response data of type `T`

## File Browser Methods

### `listDirectory(path: string): Promise<DirectoryItem[]>`

Lists contents of a directory.

- Returns array of `DirectoryItem` objects with `name`, `path`, `isDirectory`, and optional `size`

### `statFile(path: string): Promise<{ size: number; modified: number; isDirectory: boolean }>`

Gets file or directory statistics.

### `findAudioFilesRecursive(path: string): Promise<string[]>`

Recursively finds all audio files in a directory and subdirectories.

- Returns array of file paths

## Audio Methods

### `getAudioDuration(path: string): Promise<number>`

Gets audio file duration in seconds using `music-metadata` library.

### `getAudioFileUrl(path: string, showNotification?: boolean): Promise<AudioFileUrl>`

Returns a playable URL for a local audio file. File contents are **not** sent over IPC — only a base64url-encoded UTF-8 path.

- Returns: `{ url: string }` where `url` is `cherryplay-audio:///<base64url(utf8-absolute-path)>`
- Main process streams the file via `protocol.handle('cherryplay-audio')` and `net.fetch(file://…)`
- Used by `createDefaultPlatformAudioAdapter` for main and demo playback engines
- See [Playback Engine — loading path](./docs/modules/audio/playback-layers.md#загрузка-файлов-electron)

## Dialog Methods

### `showFolderDialog(options?: { title?: string; defaultPath?: string }): Promise<string | null>`

Shows folder selection dialog.

- Returns selected folder path or `null` if cancelled

### `showSaveDialog(options?: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null>`

Shows save file dialog.

- Returns selected file path or `null` if cancelled

### `showOpenFileDialog(options?: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null>`

Shows open file dialog.

- Returns selected file path or `null` if cancelled

## System Methods

### `getSystemPath(name: string): Promise<string>`

Gets system path (documents, music, downloads, etc.).

- `name` - System path name (e.g., 'documents', 'music', 'downloads')

## IPC Channels

All IPC channels are whitelisted in `electron/preload.ts` for security. Only whitelisted channels can be invoked from renderer process.

### File Browser Channels

- `fileBrowser:listDirectory` - List directory contents
- `fileBrowser:statFile` - Get file/directory statistics
- `fileBrowser:findAudioFilesRecursive` - Recursively find audio files

### Audio Channels

- `audio:getDuration` - Get audio file duration
- `audio:getFileUrl` - Get `cherryplay-audio://` streaming URL for local file (path encoding only)

### Export Channels

- `export:execute` - Execute export with number prefix strategy
- `export:copyFile` - Copy single file (internal use)
- `export:aimp` - Export playlist to AIMP format (M3U8)
- `export:copyTracksToFolder` - Copy tracks to folder with original names

### Playlist Channels

- `playlist:save` - Save playlist to JSON file
- `playlist:load` - Load playlist from JSON file

### Dialog Channels

- `dialog:showOpenDialog` - Show folder selection dialog
- `dialog:showSaveDialog` - Show save file dialog
- `dialog:showOpenFileDialog` - Show open file dialog

### System Channels

- `system:getPath` - Get system path (documents, music, etc.)

## 6.5 Component Example

### PlaylistView Component

**Location**: `src/workspaces/playlist/PlaylistView.tsx`

Main component for displaying and editing playlists. Implements drag-and-drop functionality for reordering tracks using native HTML5 Drag and Drop API.

**Key Features:**

- Display list of tracks from `playlistStore`
- Edit playlist name
- Drag-and-drop for reordering tracks
- Visual insertion point indicator (blue line)
- Track selection and batch operations
- Display total playlist duration

**Drag-and-Drop Implementation:**

The component uses native HTML5 Drag and Drop API without external libraries. Supports dragging tracks within the playlist, adding files from FileBrowser, and **cross-workspace drag-and-drop** (moving tracks between playlists and collections).

**Unified Drag-and-Drop System:**

The drag-and-drop system is **completely workspace-agnostic** - it works with any track-based workspace (playlists, collections, or future workspace types) without hardcoded dependencies. The system uses workspace IDs to identify source and target, making it fully extensible.

Key architectural principles:

- **Workspace Independence**: No hardcoded references to specific workspace types (playlist, collection, etc.)
- **ID-Based Routing**: All operations use `WorkspaceId` to locate stores via `getTrackWorkspaceStore()`
- **Centralized Store**: `dragDropStore` handles all cross-workspace operations using workspace IDs
- **Global State**: `draggedItems` is stored in `uiStore` for cross-component access, includes `sourceWorkspaceId` and `isCopyMode`
- **Unified Logic**: Move by default, copy with Ctrl/Cmd key (detected in `handleDragOver`, stored in `draggedItems.isCopyMode`)
- **Hook Abstraction**: `useTrackWorkspaceDragAndDrop` works for any track-based workspace - just pass `workspaceId`

1. **State Management:**
   - `draggedItems`: Unified state for all drag types:
     - `{ type: 'tracks'; ids: Set<string>; sourceWorkspaceId?: WorkspaceId; isCopyMode?: boolean }` - dragged tracks (supports group dragging)
       - `sourceWorkspaceId`: Workspace identifier from which tracks are dragged (for determining cross-workspace operations)
       - `isCopyMode`: Ctrl/Cmd key state (determined in `handleDragOver`, saved for use in `handleDrop`, as `e.ctrlKey` may be unavailable in drop event)
     - `{ type: 'files'; paths: string[] }` - dragged files from FileBrowser
     - `null` - no active dragging
   - `dragOverId`: ID of the track over which the cursor is located (or null for empty space)
   - `insertPosition`: Insertion position ('top' | 'bottom' | null) relative to the element

2. **Event Handlers:**
   - `handleDragStart(e, trackId)`: Initializes track dragging. If the dragged track is selected together with others, all selected tracks are dragged. Otherwise, only one track is dragged. Sets `draggedItems` with type 'tracks', including `sourceWorkspaceId` of the current workspace for determining cross-workspace operations. Sets `e.dataTransfer.effectAllowed = 'copyMove'` to allow copy and move operations.
   - `handleDragOver(e, context: DropContext)`: Determines cursor position relative to the element (upper/lower half), updates visual indicator. For cross-workspace operations, determines Ctrl/Cmd key state (`e.ctrlKey || e.metaKey`) and saves it in `draggedItems.isCopyMode` (as `e.ctrlKey` may be unavailable in drop event). Updates `dropEffect` to 'copy' or 'move' depending on `isCopyMode`. Supports both tracks and files. For files, sets `draggedItems` with type 'files'. Does not show indicator over dragged tracks.
   - `handleDrop(e, context: DropContext)`: Handles drop operation. Uses saved `isCopyMode` value from `draggedItems` (not `e.ctrlKey`) to determine copy or move. Determines drag type from `dataTransfer.types`. Calculates final insertion index considering position and offset. Supports both single move (`moveTrack`) and group move (`moveSelectedTracks`). For cross-workspace operations, uses `dragDropStore` methods. For files, uses `addTracksAt`.
   - `handleDragEnd()`: Clears drag state (no parameters, as opacity is restored via CSS class)
3. **Container Event Handlers:**
   - `onDragOver` (container): Handles dragging into empty container space. Determines drag type from `dataTransfer.types`. For files and tracks, resets `dragOverId` and `insertPosition` to allow drop in empty space.
   - `onDragLeave` (container): Checks that cursor has actually left the container area (not moved to a child element), using `relatedTarget` and coordinates.
   - `onDrop` (container): Handles drop in empty container space. For files, adds them to the end via `addTracks()`. For tracks, moves them to the end of the list.

4. **Visual Feedback:**
   - All dragged elements become semi-transparent (opacity: 0.5) - group dragging is supported
   - Blue line indicator (`drag-insert-line`) is displayed at the insertion point
   - Line appears above or below the element depending on cursor position
   - Line is shown only for tracks, not for files (files don't have visual indicator in empty space)
   - Pulsing animation of the line for better visibility
   - Indicator is not shown over dragged tracks

5. **Index Calculation Logic:**

   **For single track move:**

   Calculate final insertion index. If insertPosition is 'bottom', increment dropIndex. Adjust index considering move direction: when moving element down (oldIndex < dropIndex), after removing the element, all elements after oldIndex shift up by 1 position, so subtract 1 from finalIndex. Limit index to list range.

   **For group track move:**

   Calculate final insertion index. If insertPosition is 'bottom', increment dropIndex. Count how many dragged tracks are before the insertion point. Adjust index by subtracting the number of dragged tracks that are already before the insertion point. Limit index to range (considering group size).

   **For files:**
   - On drop on track element: `insertPosition` is used to determine position
   - On drop in empty space: files are added to the end via `addTracks()`

6. **Group Drag-and-Drop:**
   - If the dragged track is selected together with other tracks, all selected tracks are dragged
   - Relative order of selected tracks is preserved when moving
   - All dragged tracks are visually highlighted (semi-transparent)
   - `moveSelectedTracks(toIndex)` method from store is used for group move

7. **File Drag-and-Drop from FileBrowser:**
   - Files from FileBrowser are dragged with type `application/json` in `dataTransfer`
   - On drop on track element: files are inserted at element position via `addTracksAt(finalIndex)`
   - On drop in empty container space: files are added to the end via `addTracks()`
   - `draggedItems` is set in `handleDragOver` for track elements or in `handleDrop` if not set

The component uses the `usePlaylistStore` hook to get playlist state and methods. Manages drag state through local state variables `draggedItems`, `dragOverId`, `insertPosition`. Handles drag-and-drop events through handlers `handleDragStart`, `handleDragOver`, `handleDrop`, `handleDragEnd`. Renders track list through `PlaylistItem` components with support for visual insertion indicators.

### CollectionView Component

**Location**: `src/workspaces/collection/CollectionView.tsx`

React component for rendering a collection workspace. Collections are lightweight versions of playlists designed for temporary storage of tracks. They reuse the same UI and logic as playlists but are stored separately.

**Key Features:**

- **Unlimited Tracks**: Collections have no track limit (`maxTracks: null`)
- **Independent Store**: Each collection has its own Zustand store created via `trackWorkspaceStoreFactory`
- **Full Functionality**: Supports all playlist features:
  - Track selection (single, multiple, range)
  - Drag-and-drop reordering
  - Undo/redo history (50 actions)
  - Track duration loading
  - Statistics display (track count, total duration)
  - Renameable name
- **Cross-Workspace Drag-and-Drop**: Supports moving/copying tracks to/from playlists and other collections
- **Same UI**: Reuses `PlaylistItem` component and styling from `PlaylistView`

**Props:**

The component accepts `workspaceId` (unique collection identifier) and optional `zoneId` (layout zone ID).

**Store Creation:**

Collections use `ensureTrackWorkspaceStore()` to create or retrieve a store with options: workspaceId, initialName, maxTracks (null for unlimited), historyDepth.

**Drag-and-Drop:**

Collections use the `useTrackWorkspaceDragAndDrop` hook, which handles internal track reordering, supports cross-workspace operations via `dragDropStore`, detects Ctrl/Cmd key for copy operations and uses global `draggedItems` state from `uiStore`.

---

### Compound Components (New Architecture)

After the workspace refactoring, the application uses a compound component architecture for list items.

#### ListRowCompound

**Location**: `src/shared/components/ListRow/`

A compound component for building list item rows with flexible composition.

**Structure:**

```
ListRow/
├── ListRow.tsx           # Main container
├── ListRowContext.tsx    # Context for state sharing
├── Actions.tsx           # Actions container
├── actions/
│   ├── PlayButton.tsx
│   ├── DeleteButton.tsx
│   ├── DisableButton.tsx
│   ├── SettingsButton.tsx
│   ├── DragHandle.tsx
│   ├── Checkbox.tsx
│   ├── UngroupButton.tsx
│   └── ActionButton.tsx
├── content/
│   ├── Index.tsx
│   ├── Content.tsx
│   └── Secondary.tsx
└── index.ts
```

**Usage:**

```tsx
<ListRowCompound id={item.id} isSelected={true} isDragging={false}>
  <ListRowCompound.DragHandle />
  <ListRowCompound.Checkbox onToggle={handleToggle} />
  <ListRowCompound.Index value={0} />
  <ListRowCompound.Content>{item.name}</ListRowCompound.Content>
  <ListRowCompound.Secondary>{duration}</ListRowCompound.Secondary>
  <ListRowCompound.Actions>
    <ListRowCompound.PlayButton onPlay={handlePlay} />
    <ListRowCompound.DeleteButton onClick={handleDelete} />
  </ListRowCompound.Actions>
</ListRowCompound>
```

#### ItemList

**Location**: `src/shared/components/ItemList/`

Container component with drop logic on the container level (not on individual items). This solves the "dead zone" bug where drops between items didn't work.

**Structure:**

```
ItemList/
├── ItemList.tsx          # Main container with drag events
├── ItemListContext.tsx   # Context for drop state
├── DropIndicator.tsx     # Visual insertion line
├── EmptyState.tsx        # Empty list placeholder
└── index.ts
```

**Usage:**

```tsx
<ItemList onDragOver={handleDragOver} onDrop={handleDrop}>
  {items.map((item, index) => (
    <React.Fragment key={item.id}>
      <DropIndicator index={index} />
      <ListRow>...</ListRow>
    </React.Fragment>
  ))}
  <DropIndicator index={items.length} />
</ItemList>
```

#### ProjectItemRow

**Location**: `src/shared/components/rows/ProjectItemRow.tsx`

Universal component for displaying tracks and groups. Supports three modes:

- `'playlist'` - Basic mode with play, delete buttons
- `'player-preparation'` - Player mode with settings button
- `'player-session'` - Player mode with settings and disable buttons

**Props:**

- `item: ProjectItem` - Track or group
- `index: number` - Display index
- `level: number` - Nesting level (for groups)
- `mode: 'playlist' | 'player-preparation' | 'player-session'`
- `isSelected`, `isDragging`, `isDragOver`, `insertPosition` - Visual states
- `isActive`, `isPlaying`, `isPlayed`, `isDisabled`, `isCurrent`, `isLocked` - Playback states
- Event handlers: `onToggleSelect`, `onRemove`, `onDragStart`, etc.

**File browser rows**: The file browser (`FileBrowser` in `src/components/FileBrowser.tsx`) renders file and folder rows inline (no separate row component). Rows use classes `file-browser-item`, `file-browser-item-name`, `file-browser-item-size`; see `src/styles/components/fileBrowser.css`. The former `FileRow` component was removed as unused.

---

### PlaylistItem Component (Legacy)

> **Note**: `PlaylistItem` is being replaced by `ProjectItemRow` in the new architecture.

**Location**: `src/shared/components/PlaylistItem.tsx`

Component for displaying a single track in a playlist. Supports drag-and-drop through native HTML5 API.

**Props:**

- `track: Track` - track object
- `index: number` - index in the list
- `isSelected: boolean` - whether the track is selected
- `isDragging: boolean` - whether the track is being dragged
- `isDragOver?: boolean` - whether cursor is over the track
- `insertPosition?: 'top' | 'bottom' | null` - insertion position for visual indicator
- `onToggleSelect: (id: string) => void` - selection handler
- `onRemove: (id: string) => void` - removal handler
- `onDragStart: (e: React.DragEvent, id: string) => void` - drag start
- `onDragOver: (e: React.DragEvent) => void` - cursor over element
- `onDrop: (e: React.DragEvent, id: string) => void` - element drop
- `onDragEnd: (e: React.DragEvent) => void` - drag end

**Track Item Sizing:**

Track items use CSS variables for consistent sizing across playlist and file browser:

- `--track-item-padding`: Controlled by `trackItemSizePreset` setting (8px/12px/16px)
- `--track-item-margin`: Controlled by `trackItemSizePreset` setting (2px/4px/6px)
- These variables are initialized by `useTrackItemSize` hook in App component

**Hour Dividers:**

PlaylistView supports visual dividers showing accumulated time intervals:

- Dividers appear after tracks when accumulated duration exceeds configured interval
- Format: "hh:mm" (e.g., "1:30" for 1 hour 30 minutes)
- Controlled by `showHourDividers` and `hourDividerInterval` settings
- Dividers use `.playlist-hour-divider` and `.playlist-hour-divider-label` CSS classes

---

### SettingsModal Component

**Location**: `src/app/components/SettingsModal.tsx`

Modal window for configuring application UI. Opened via `uiStore.openModal('settings')`.

**Features:**

- **Track Item Size Preset**: Select between "Small", "Medium", "Large"
  - Small: padding 8px, margin 2px
  - Medium: padding 12px, margin 4px (default)
  - Large: padding 16px, margin 6px
- **Show Hour Dividers**: Checkbox to enable/disable dividers in playlist
- **Hour Divider Interval**: Select interval (15 min, 30 min, 1 hour, 2 hours, 3 hours)
  - Disabled when dividers are turned off

**State Management:**

- Uses local state for form inputs (`localTrackItemSizePreset`, `localHourDividerInterval`, `localShowHourDividers`)
- Syncs with `settingsStore` on modal open
- Saves to `settingsStore` on "Save" button click
- Cancels changes on "Cancel" button click

**Note**: Export settings have been moved to `ExportModal` component.

---

### ExportModal Component

**Location**: `src/app/components/ExportModal.tsx`

Modal window for configuring and executing playlist export. Opened via `uiStore.openModal('export')`.

**Features:**

- **Export Folder**: Input field with browse button for selecting target folder
- **Export Strategy**: Select between "Copy with numbering" and "AIMP playlist"

**Workflow:**

1. User clicks export button in `AppHeader`
2. `ExportModal` opens with current export settings
3. User selects folder and strategy
4. On "Export":
   - Saves settings to `settingsStore`
   - Executes export via `exportService`
   - Shows success/error notification
   - Closes modal
5. On "Cancel": Closes modal without saving or exporting

**Integration:**

- Triggered from `AppHeader.handleExport()` when export button is clicked
- Uses `usePlaylistStore` to get tracks and playlist name
- Uses `useSettingsStore` to get/set export settings
- Uses `useUIStore` for notifications and modal management

---

### useTrackItemSize Hook

**Location**: `src/shared/hooks/useTrackItemSize.ts`

React hook that initializes and updates CSS variables for track item sizes based on the selected preset from settings.

**Implementation:**

The hook uses `useSettingsStore` to get `trackItemSizePreset`. Defines size presets: small (padding 8px, margin 2px), medium (padding 12px, margin 4px), large (padding 16px, margin 6px). In `useEffect`, sets CSS variables `--track-item-padding` and `--track-item-margin` on the document root element depending on the selected preset.

**Usage:**

The hook is called once at the application root level (in App.tsx) to initialize CSS variables.

**Behavior:**

- Reads `trackItemSizePreset` from `settingsStore`
- Sets CSS variables `--track-item-padding` and `--track-item-margin` on document root
- Updates variables when preset changes
- Should be called once at app root level

**CSS Variables:**

These variables are used by:

- `.playlist-item` in `src/styles/components/playlist.css`
- `.file-browser-item` in `src/styles/components/fileBrowser.css` (FileBrowser component)

---

# 7. Data Formats

## 7.1 Track Object

Track object contains: `id` (unique identifier), `path` (file path), `name` (track name), `duration` (optional duration in seconds, extracted via music-metadata).

## 7.2 Playlist File (JSON)

Playlist JSON file contains an object with fields: `name` (playlist name) and `tracks` (array of track objects).

Each track object in the `tracks` array can contain:

- `path: string` - **Required**. File path to the track
- `name?: string` - **Optional**. Track name (if not provided, extracted from path)
- `duration?: number` - **Optional**. Track duration in seconds

Example:

```json
{
  "name": "My Playlist",
  "tracks": [
    { "path": "C:/Music/track1.mp3", "name": "Track 1", "duration": 180 },
    { "path": "C:/Music/track2.mp3" }
  ]
}
```

When loading a playlist via `loadFromJSON()`, tracks without `name` will have it extracted from the path, and tracks without `duration` will have it loaded asynchronously via IPC.

## 7.3 Project File Format (.cherry)

The `.cherry` format is the primary project file format, supporting tracks, groups, settings, and session state.

### File Structure

```typescript
interface ProjectFile {
  version: '2.0'; // Format version
  name: string; // Project name
  items: SavedProjectItem[]; // All items (flat list with references)
  rootItems: string[]; // IDs of root-level items (order matters)
  settings: ProjectSettings; // Global settings
  trackSettings: Record<string, ProjectTrackSettings>; // Per-track settings
  groupSettings: Record<string, ProjectGroupSettings>; // Per-group settings
  sessionState?: ProjectSessionState; // Optional session state
}
```

### Item Types

```typescript
// Track
interface SavedProjectTrack {
  type: 'track';
  id: string;
  path: string;
  name: string;
  duration?: number;
}

// Group (items are IDs, not nested objects)
interface SavedProjectGroup {
  type: 'group';
  id: string;
  name: string;
  items: string[]; // Array of item IDs
}
```

### Settings

```typescript
interface ProjectSettings {
  defaultPauseBetweenTracks: number; // Default pause in seconds
  defaultActionAfterTrack: 'next' | 'pause' | 'pauseAndNext';
  plannedEndTime: number | null; // Unix timestamp or null
}

interface ProjectTrackSettings {
  pauseBetweenTracks?: number | null; // Override default
  actionAfterTrack?: 'next' | 'pause' | 'pauseAndNext' | null;
}
```

### Session State

```typescript
interface ProjectSessionState {
  mode: 'preparation' | 'session';
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  currentTrackId: string | null;
  sessionStartTime: number | null;
}
```

### Example

```json
{
  "version": "2.0",
  "name": "My Party Playlist",
  "items": [
    {
      "type": "track",
      "id": "t1",
      "path": "C:/Music/song1.mp3",
      "name": "Song 1",
      "duration": 180
    },
    {
      "type": "track",
      "id": "t2",
      "path": "C:/Music/song2.mp3",
      "name": "Song 2",
      "duration": 240
    },
    { "type": "group", "id": "g1", "name": "Chill Set", "items": ["t1", "t2"] }
  ],
  "rootItems": ["g1"],
  "settings": {
    "defaultPauseBetweenTracks": 0,
    "defaultActionAfterTrack": "next",
    "plannedEndTime": null
  },
  "trackSettings": {},
  "groupSettings": {}
}
```

### Validation

The `projectValidation.ts` module provides validation with graceful degradation:

- `validateProjectFile(data)` - Validates structure, returns errors/warnings
- `validateProjectIntegrity(projectFile)` - Checks reference integrity

### Quick Save (Ctrl+S)

When a project has been saved before (`meta.filePath` is set), Ctrl+S saves directly without dialog. Ctrl+Shift+S always shows "Save As" dialog.

### Dirty Indicator

The `meta.isDirty` flag tracks unsaved changes. UI shows `*` indicator in project name when dirty.

## 7.4 Playlist File (JSON) - Legacy Format

> **Note**: The JSON format is still supported for Collections via `trackWorkspaceStoreFactory`. For main project data, use `.cherry` format.

## 7.5 AIMP Playlist Format (M3U8)

AIMP supports multiple playlist formats, but for mobile AIMP compatibility, **M3U8** (UTF-8 encoded M3U) is used.

### Export Process

1. User selects a target folder via dialog
2. A subfolder is created with the playlist name (or auto-generated name)
3. All tracks are copied to this subfolder with their original filenames
4. A `.m3u8` playlist file is created in the same subfolder
5. The playlist file uses relative paths pointing to the copied tracks in the same folder

### Format Specification

- **Header**: `#EXTM3U` (UTF-8 with BOM for compatibility)
- **Paths**: Relative paths from playlist file to track files
- **Path format**: Use forward slashes `/` (M3U standard)
- **Encoding**: UTF-8

### Example

If playlist is exported to: `D:/Exports/MyPlaylist/`

- Tracks are copied to: `D:/Exports/MyPlaylist/track1.mp3`, `track2.mp3`, etc.
- Playlist file: `D:/Exports/MyPlaylist/MyPlaylist.m3u8`
- Playlist content: Header `#EXTM3U`, then list of relative paths to tracks (e.g., `track1.mp3`, `track2.mp3`, `track3.mp3`)

This structure allows moving the entire `MyPlaylist` folder to another location (including mobile devices) without breaking playlist paths.

---

# 8. Plugin Architecture

Plugins can extend: - Track sources - Export strategies - Utility
panels - Automated tools (future)

## Plugin Directory Structure

    plugin/
      manifest.json
      index.js
      assets/

## Manifest Example

Manifest file contains a JSON object with fields: `name` (plugin name), `version` (version), `entry` (entry point, e.g., index.js), `type` (plugin type, e.g., "source").

## Plugin API Structure

Plugin exports an object with methods `init(api)` and `destroy()`. API includes methods: `registerTrackSource(source)`, `registerExportStrategy(strategy)`, `getSettings()`, `log()`.

---

# 9. UI/UX Detailed Specification

## 9.1 Design System Overview

### 9.1.1 Theme System

The application uses a **dark theme** by default with a modular theme system that allows for easy theme switching and future theme additions.

**Theme Structure:**

- All colors are centralized in a theme configuration object
- Theme can be switched through settings
- Theme configuration includes: colors, typography, spacing, component styles

### 9.1.2 Color Palette (Dark Theme)

All colors are defined in a centralized theme configuration for easy modification. Structure includes: background (primary, secondary, tertiary, hover), text (primary, secondary, disabled), accent (primary, secondary, border), state (selected with background and border, success, error, warning, info), ui (divider, dragHandle, deleteButton).

**Recommended Dark Theme Colors (Best Practices):**

- Background primary: `#1e1e1e` or `#121212`
- Background secondary: `#2d2d2d` or `#1f1f1f`
- Background tertiary: `#3a3a3a`
- Text primary: `#ffffff` or `#e0e0e0`
- Text secondary: `#b0b0b0` or `#9e9e9e`
- Accent primary: `#6495ed` or `#5a9fd4`
- Selected background: `#3a4a5a`
- Selected border: `#6495ed` (2px solid)
- Divider: `#404040` or `#333333`

### 9.1.3 Typography

**Font Family:**

- Primary: System font stack (best practice for desktop apps)
- Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif`

**Font Sizes:**

- Heading (Playlist name): `20px` or `1.25rem`, weight: `600`
- Body (Track names): `14px` or `0.875rem`, weight: `400`
- Secondary (Metadata, paths): `12px` or `0.75rem`, weight: `400`
- Small (Breadcrumbs, technical info): `11px` or `0.6875rem`, weight: `400`

**Line Heights:**

- Heading: `1.4`
- Body: `1.5`
- Secondary: `1.4`

### 9.1.4 Spacing System

**Base unit:** `4px` or `0.25rem`

**Spacing Scale:**

- `xs`: `4px` (0.25rem)
- `sm`: `8px` (0.5rem)
- `md`: `16px` (1rem)
- `lg`: `24px` (1.5rem)
- `xl`: `32px` (2rem)
- `xxl`: `48px` (3rem)

**Component Spacing:**

- Panel padding: `16px` (md)
- Track item padding: `12px` (sm + xs)
- Button padding: `8px 16px`
- Input padding: `8px 12px`
- Gap between elements: `8px` (sm)

### 9.1.5 Icon System

**Icon Library:** Material Icons

**Icon Sizes:**

- Small: `18px`
- Medium: `24px`
- Large: `32px` (header buttons)
- Extra Large: `48px`

**Icon Usage:**

- Header buttons: Large (32px)
- Track actions (drag handle, delete): Medium (24px)
- Inline icons: Small (18px)

## 9.2 Window and Layout

> **⚠️ Legacy / partially outdated.** This section reflects early layout design. For **current** workspace and edit-mode behavior, use:
>
> - [CherryPlayList/docs/layout-edit-mode.md](docs/layout-edit-mode.md) — workspace **pill** + **✎** edit mode, auto-save, zone picker, air regions
> - [CherryPlayList/docs/modules/systems/layout-system.md](docs/modules/systems/layout-system.md) — built-in presets, persist key, `LayoutWorkspaceArea` render paths
>
> Below: retained historical detail; API names, UI controls, persist key, and constraints may differ from the implementation.

### 9.2.1 Window Configuration

- **Default size:** Standard desktop size (e.g., `1200x800px` or `1400x900px`)
- **Minimum size:** `800x600px`
- **Resizable:** Yes
- **Fullscreen support:** Yes (toggle available)
- **Dynamic sizing:** Window size adapts to content and user preferences

### 9.2.2 Main Layout Structure

Main layout structure: fixed HEADER at the top with action buttons (New, Save, Load, Export, Undo, Redo, Settings), playlist name and statistics. Below is a split into two panels: PLAYLIST PANEL (track list, drag & drop, selection) and SOURCES PANEL (file browser, navigation, search). Both panels are resizable.

### 9.2.3 Panel Resizing

- **Resizable divider:** Thin line between panels
- **Resize method:** Drag divider to adjust panel widths
- **Minimum panel width:** `100px` per panel
- **Default split:** User-adjustable (typically 50/50 or 60/40)
- **Visual feedback:** Cursor changes to resize indicator on hover

### 9.2.4 Universal Split Container System

The application uses a universal recursive split container system for flexible workspace layout management. This system allows users to create complex multi-zone layouts with nested containers.

#### 9.2.4.1 Architecture Overview

**Core Concept:**

- The layout is represented as a recursive tree structure
- Each node can be either a **container** (splits space) or a **workspace zone** (displays content)
- Containers can be nested infinitely (practical limit: 6 levels)
- All zones divide space using percentage-based sizing
- Users can resize zones by dragging dividers between them

**Data Structure:**

Layout is represented as a recursive tree structure. Types: `ZoneType` ('container' | 'workspace'), `SplitDirection` ('horizontal' | 'vertical'). `WorkspaceZone` contains id (UUID), type ('workspace'), workspaceId, workspaceType, size (percentage 0-100). `ContainerZone` contains id (UUID), type ('container'), direction, zones (recursive structure), sizes (percentages for each zone, sum = 100). `Zone` is either WorkspaceZone or ContainerZone. `Layout` contains rootZone and version (for future migrations).

#### 9.2.4.2 Functional Requirements

**Zone Management:**

- **Minimum zone size:** per `workspaceType` on `IWorkspaceModule` (`minWidth` / `minHeight`); enforced during resize via `getMinSizePercentsForContainer()` — see [layout-system.md](docs/modules/systems/layout-system.md) § «Минимальные размеры зон» and `layoutWorkspaceMins.ts`
- **Maximum zones per container:** 10 zones
- **Maximum nesting depth:** 6 levels (prevents infinite recursion)
- **Auto-cleanup:** If a container has only 1 child, the container is removed and replaced by its child
- **Percentage-based sizing:** All zones use percentage distribution (sum always equals 100%)

**Resize Behavior:**

- Users can drag dividers to adjust zone sizes
- When resizing, adjacent zones adjust proportionally
- Minimum per-workspace-type sizes are enforced (JS clamp in `SplitContainer`, not CSS on zones) — resize stops when either adjacent sibling would violate its `minWidth`/`minHeight`; see [layout-system.md](docs/modules/systems/layout-system.md)
- Sizes are recalculated to maintain 100% total
- Layout preserves percentage ratios when window is resized

**Workspace Integration:**

- Each workspace zone is linked to a `WorkspaceId`
- Drag-and-drop works across all zones regardless of nesting level
- Zone IDs are stored in workspace info for layout restoration

**Persistence:**

- Workspace and layout tree persist via Zustand `persist` → **`cherryplaylist-workspaces`** (`electronStorage` / localforage, typically IndexedDB)
- `isLayoutEditMode` and `baselineLayout` are **not** persisted
- Layout is restored on application startup; built-in presets are not stored as user rows — see [layout-system.md](docs/modules/systems/layout-system.md)

#### 9.2.4.3 Component Structure

**SplitContainer Component:**

- Recursive component that renders container zones
- Handles mouse events for divider dragging
- Enforces per-workspace-type minimum sizes during resize (JS clamp via `getMinSizePercentsForContainer` — no CSS min on zones); see [layout-system.md](docs/modules/systems/layout-system.md) § «Минимальные размеры зон»
- Tracks resizing state for visual feedback
- Limits nesting depth to 6 levels

**WorkspaceRenderer Component:**

- Renders workspace zones based on `workspaceType` via **`workspaceRegistry`** (`IWorkspaceModule.component`)
- Example mappings: `'playlist'` → `PlaylistView`, `'fileBrowser'` → `FileBrowserWorkspaceView` (`SourcesPanel` + `FileBrowser`)
- Future types register in `src/workspaces/*/index.ts` and bootstrap import in `entry.tsx`

**LayoutStore** (`src/shared/stores/layoutStore.ts`):

- Zustand store with `persist` middleware; storage key **`cherryplaylist-workspaces`** (see [persisted-client-state.md](docs/modules/systems/persisted-client-state.md))
- Manages workspace state: `layout` tree, `activeWorkspace`, `userWorkspaces`, `isLayoutEditMode` (runtime only)
- Zone tree operations: `addAdjacentWorkspace`, `addAdjacentWorkspaceToContainer`, `addInitialWorkspace`, `removeWorkspaceZone`, `updateZoneSize`, `updateContainerSizes`
- Workspace lifecycle: `activateWorkspace`, `autoCommitWorkspaceChanges`, `saveCurrentWorkspaceAsUnnamed`
- Legacy helpers may still exist (`addZone`, `removeZone`, `setLayoutPreset`) — prefer docs above for edit mode

**Layout min-size utilities:**

- `src/shared/utils/layoutWorkspaceMins.ts` — `computeMinLayoutSize`, `getMinSizePercentsForContainer`, `getWorkspaceMinSize`, `computeMinWindowSize`
- `src/shared/utils/layoutViewportBridge.ts` — live layout viewport for add-feasibility checks
- `src/shared/utils/layoutWorkspaceOperations.ts` — add/remove tree ops, `enforceMinSizeFeasibility`
- `src/app/hooks/useWindowMinSize.ts` — measures layout viewport, registers bridge, sets Electron min window via IPC (`electron/ipc/system.ts`)

**UI (current):** workspace **pill** (name + ▾) and separate **✎** button in `WorkspaceMenu` — not a preset dropdown. Built-in presets are chosen from the pill menu → **Встроенные**.

#### 9.2.4.4 Visual Design

**Divider:**

- **Visible bar:** `min-width` / `min-height` **6px** (`split-divider` in `app.css`); background `#000000`, hover `#1a1a1a`
- **Hit area:** invisible `::before` padding **4px** around the bar for easier dragging
- **Edit mode:** class `split-divider--layout-edit` — только `z-index: 5` (наложение над air-зонами); цвет divider как в обычном режиме
- **Cursor:** `col-resize` (horizontal split), `row-resize` (vertical split)

**Container:**

- **Display:** Flexbox (`flex-direction: row` for horizontal, `column` for vertical)
- **Overflow:** Hidden (prevents content overflow)
- **Background:** `var(--bg-secondary)`

**Zone:**

- **Minimum size:** per `workspaceType` on `IWorkspaceModule` (final allocated pixels; enforced in JS during divider drag)
- **Flex basis:** Percentage-based (`flex: 0 0 ${size}%`)
- **Overflow:** Hidden

#### 9.2.4.5 Edge Cases and Constraints

**Single Zone in Container:**

- When a container has only 1 child, the container is automatically removed
- The child zone replaces the container in the parent
- This prevents unnecessary nesting levels

**Maximum Constraints:**

- **10 zones per container:** Adding more zones is prevented (toast warning in edit mode)
- **6 nesting levels:** Deeper nesting is rejected when adding zones (`MAX_LAYOUT_DEPTH`)

**Resize Constraints:**

- Per-type minimum sizes are enforced via `getMinSizePercentsForContainer` (hard clamp on both neighbors)
- When dragging would violate a minimum, the divider position does not update
- Adjacent zones adjust proportionally to maintain 100% total
- Electron: minimum window size tracks layout via `useWindowMinSize` + `computeMinWindowSize`

**Window Resize:**

- Layout maintains percentage ratios when window is resized
- All zones scale proportionally
- Minimum sizes are recalculated based on new container dimensions

#### 9.2.4.6 Integration with Drag-and-Drop

**Cross-Zone Drag-and-Drop:**

- Drag-and-drop operations work across all zones regardless of nesting
- `DropContext` includes `zoneId` for zone identification
- Workspace ID is linked to zone ID for proper routing
- All existing drag-and-drop functionality (tracks, files, folders) works in nested layouts

**Zone Identification:**

- Each workspace zone has a unique `zoneId`
- `WorkspaceInfo` includes `zoneId` for layout restoration
- Drag-and-drop handlers receive zone context for proper routing

#### 9.2.4.7 Initial Layout

**Default Layout:**

The application supports multiple layout presets:

1. **Simple Layout** (`'simple'`):
   - Root container with horizontal split
   - Two workspace zones:
     - Left: Playlist workspace (50%)
     - Right: FileBrowser workspace (50%)

2. **Collections Layout** (`'collections'`) - **Default**:
   - Root container with horizontal split:
     - Left: Playlist workspace (33.33%)
     - Right: Vertical container (66.67%)
       - Top: Horizontal container (50%)
         - Collection 1 workspace (50%)
         - Collection 2 workspace (50%)
       - Bottom: FileBrowser workspace (50%)

3. **Collections Vertical Layout** (`'collections-vertical'`):
   - Root container with horizontal split:
     - Left: Playlist workspace (33%)
     - Middle: Vertical container (33%)
       - Collection 1 workspace (50%)
       - Collection 2 workspace (50%)
     - Right: FileBrowser workspace (34%)
   - Allows simultaneous viewing of collections and file browser

4. **Complex Layout** (`'complex'`):
   - Includes test zones for development (DEV-only in menu)

5. **Player Layout** (`'player'`):
   - Focused playback workspace preset

6. **Party Layout** (`'party'`):
   - Online party: `party-editor` + `party-preview` zones (requires `enableStreaming`)

7. **AIMP + Party** (`'aimp-party'`) — **legacy:** migrated to `'party'` on load; not shown in pill menu

**Layout Presets:**

Layout presets are defined in `layoutStore.ts` (`createLayoutByPreset`). Selection: workspace pill **▾** → **Встроенные**. Default on first run: **`collections`**. Interactive editing: **✎** — see [layout-edit-mode.md](docs/layout-edit-mode.md).

Available presets:

- `'simple'`: Playlist + FileBrowser
- `'collections'`: Playlist + nested collections + FileBrowser (**default**)
- `'collections-vertical'`: Playlist + vertical collections + FileBrowser
- `'complex'`: Test layout with multiple nested zones (**development only**)
- `'player'`: Playback-focused layout
- `'party'`: Party editor + preview (when streaming enabled)
- `'aimp-party'`: **legacy** — auto-migrates to `'party'`

**Layout Migration:**

- Existing static layout in `App.tsx` is replaced with dynamic `SplitContainer`
- Initial layout is created programmatically on first run
- Layout can be reset to default if corrupted
- Collections are automatically created and registered when using the `'collections'` preset

## 9.3 Header Component

### 9.3.1 Header Structure

**Top Row - Action Buttons:**

- **Group 1 (File):** New, Save, Load (Material Icons)
- **Group 2 (Actions):** Export (Material Icons)
- **Group 3 (History):** Undo, Redo (Material Icons) - separate group
- **Group 4 (Settings):** Settings (Material Icons)

**Button Specifications:**

- Size: Large icons (32px)
- Style: Android-like (Material Design)
- Tooltips: Yes, on hover (Russian language)
- Spacing: `8px` between buttons, `16px` between groups
- Disabled state: Visual indicator when action unavailable (e.g., Undo/Redo)

**Second Row - Playlist Info:**

- **Playlist name:** Editable text field or display
- **Technical information:** Single line with icons
  - Format: `📊 [count] tracks • ⏱️ [duration]`
  - Icons: Material Icons (list icon for count, timer/clock icon for duration)
  - Font size: `12px` (secondary text)
  - Color: Text secondary
  - Extensible: Structure allows adding more metrics via settings

### 9.3.2 Undo/Redo System

**Implementation:**

- **Actions tracked:** Delete tracks, Move tracks, Add tracks (including batch operations)
- **History depth:** Maximum 50 actions
- **Scope:** Current session only (not persisted)
- **Visual indicators:** Buttons disabled when no history available
- **Batch operations:**
  - Adding multiple tracks (from folder or selection) = 1 action
  - Moving multiple selected tracks = 1 action
  - Deleting multiple tracks = 1 action per deletion (or batch if implemented)

## 9.4 Playlist Panel

### 9.4.1 Track List Item

**Layout Structure:**

Track element contains from left to right: play button (Play/Pause), drag handle (three horizontal lines), track number (large, left-aligned), track name (main content centered), duration (M:SS format, right), delete button (always visible, right).

**Item Specifications:**

- **Height:** Medium (~60px)
- **Padding:** `12px` (sm + xs)
- **Background:** Background tertiary
- **Hover state:** Background hover color
- **Selected state:**
  - Background: `#3a4a5a`
  - Border: `2px solid #6495ed`
  - Applied to all selected tracks

- **Element Details:**
-
- **Play button:**
  - Icon: `play_arrow` / `pause` (Material Icons)
  - Position: Far left before drag handle
  - Clicking loads the track into `demoPlayerStore` and starts playback
  - Highlights when the track currently playing matches the row
- **Drag handle:**
  - Icon: Three horizontal lines (Material Icons: `drag_handle`)
  - Position: Leftmost
  - Size: `24px`
  - Always visible
  - Color: UI drag handle color
- **Track number:**
  - Position: Left, after drag handle
  - Size: Large, prominent
  - Format: `01`, `02`, etc. (2-digit, zero-padded)
  - Color: Text secondary
- **Track name:**
  - Position: Center, main content
  - Size: Body text (14px)
  - Color: Text primary
  - Truncation: Ellipsis if too long
- **Duration:**
  - Position: Right, before delete button
  - Format: `M:SS` (e.g., `3:45`, `12:30`)
  - Fallback: `--:--` if duration not available
  - Size: Secondary text (12px)
  - Color: Text secondary
- **Delete button:**
  - Icon: Close/X (Material Icons: `close`)
  - Position: Rightmost
  - Size: `24px`
  - Always visible
  - Color: UI delete button color
  - Action: Immediate deletion (no confirmation)
  - Creates undo action

### 9.4.2 Empty State

- **Display:** Nothing shown (blank panel)
- **No placeholder text or icons**

### 9.4.3 Selection System

**Selection Methods:**

- **Checkbox:** Click checkbox to toggle selection
- **Item click:** Click on track item to select
- **Ctrl+Click:** Toggle individual track selection
- **Shift+Click:** Select range from last selected to current
- **Select All:** Button in playlist header

**Visual Feedback:**

- Selected tracks: Background `#3a4a5a`, border `2px solid #6495ed`
- Checkbox: Material Icons checkbox (checked/unchecked states)

**Batch Operations:**

- **Delete Selected:** Button in header (visible when tracks selected)
- **Move Selected:** Drag any selected track by its drag handle to move all selected tracks together
  - Dragged tracks remain in place with selection highlighting during drag
  - Preserves relative order of selected tracks
  - All selected tracks move as a group
  - Other tracks do not shift during drag

## 9.5 Sources Panel (File Browser)

### 9.5.1 Navigation Tools (Top Section)

**Toolbar Components:**

- **Back button:** Navigate to parent directory (Material Icons: `arrow_back`)
- **Up button:** Navigate one level up (Material Icons: `arrow_upward`)
- **Breadcrumbs:**
  - Clickable path segments
  - Format: `Home > Music > Playlists > Current`
  - Maximum length: Adaptive (truncate with `...` if too long)
  - Font size: Small (11px)
  - Color: Text secondary
  - Click action: Navigate to clicked segment
- **Search field:**
  - Position: Right side of toolbar
  - Placeholder: "Search..."
  - Behavior: Real-time recursive search (searches all subdirectories)
  - Search scope: File and folder names
  - Results display: See section 9.5.3

**Layout:**

Navigation panel contains from left to right: "Back" button (←), "Up" button (↑), breadcrumbs (Home > Music > Playlists), search field on the right (🔍 Search...).

### 9.5.2 File List

**Display Format:**

- Simple list view (not icons or tree)
- Folders and files in single list
- Folders: Icon + name
- Files: Icon + name (only audio files shown)

**Item Specifications:**

- **Height:** Medium (~50px)
- **Padding:** `8px` (sm)
- **Hover state:** Background hover color
- **Click action:**
  - Folder: Navigate into folder (double-click or single-click based on OS convention)
  - File: Select for drag (or add to playlist on drag)

**Sorting:**

- Folders first, then files
- Alphabetical within each group

### 9.5.3 Search Results

**Display Format:**

- Results shown in main file list area
- Each result shows:
  - **File/folder name** (primary text)
  - **Path** (secondary text, small font, below name)
    - Format: Full path to file
    - Font size: `11px`
    - Color: Text secondary
- **No text highlighting** in results

**Search Behavior:**

- **Recursive:** Searches all subdirectories from current location
- **Real-time:** Updates as user types
- **Scope:** File and folder names only
- **Case sensitivity:** Case-insensitive (best practice)

### 9.5.4 Empty State

- **Scenario:** Should not occur (always show at least root directory)
- **If empty:** Show message "Folder is empty" or similar

## 9.7 Modal Windows

### 9.7.1 Modal Specifications

**General:**

- **Position:** Centered on screen
- **Size:** Adaptive (content-based)
- **Animation:** None (instant open/close)
- **Close methods:**
  - Close button (X) in top-right corner
  - Cancel button
  - Click outside modal (optional, implement if standard)

**Modal Types:**

- **Settings:** Configuration modal
- **Error:** Error display modal
- **Future:** Export options, etc.

**Styling:**

- Background: Background secondary with overlay
- Border: Accent border color
- Padding: `24px` (lg)
- Max width: Adaptive (typically `500-800px`)
- Max height: Adaptive (typically `400-600px`)

### 9.7.2 Settings Modal

**Content:**

- Export path selection
- Export strategy selection
- Theme selection (future)
- Technical info display options (future)
- Other preferences

**Components:**

- Input fields
- Folder picker button
- Dropdowns/selects
- Save/Cancel buttons

### 9.7.3 Error Modal

**Content:**

- Error message
- Error details (if applicable)
- Close button

## 9.8 Notifications System

### 9.8.1 Notification Specifications

**Display:**

- **Position:** Best practice placement (typically top-right or bottom-right)
- **Duration:** Best practice timing (typically 3-5 seconds)
- **Style:** Toast notifications (non-blocking)
- **Types:** Success, Error, Info, Warning

**Visual Design:**

- Background: Background secondary with opacity
- Border: Accent border (color varies by type)
- Icon: Material Icons (check, error, info, warning)
- Text: Primary text color
- Animation: Slide in/out (subtle)

**Behavior:**

- Auto-dismiss after duration
- Manual dismiss: Click X or click notification
- Stacking: Multiple notifications stack vertically

## 9.9 Loading States

### 9.9.1 Spinner Usage

**Spinners shown for:**

- Loading track duration (when adding tracks)
- Exporting playlist (progress indication)
- Searching files in folder (recursive search)
- Any async operation

**Spinner Specifications:**

- **Style:** Material Design circular progress indicator
- **Size:**
  - Small: `16px` (inline, e.g., in duration column)
  - Medium: `24px` (buttons, actions)
  - Large: `48px` (full-page loading)
- **Color:** Accent primary
- **Position:**
  - Duration loading: In duration column
  - Export: Progress bar or spinner in export button/modal
  - Search: In search field or results area

### 9.9.2 Loading Cursor

**Usage:**

- When dragging large folder (many tracks to process)
- Cursor changes to loading indicator
- Returns to normal when processing complete

## 9.10 Component States

### 9.10.1 Button States

- **Default:** Accent primary background, primary text
- **Hover:** Lighter/darker shade of accent
- **Active:** Pressed state (darker)
- **Disabled:** Reduced opacity, non-interactive
- **Loading:** Spinner replaces or overlays icon

### 9.10.2 Input States

- **Default:** Border accent, background secondary
- **Focus:** Border accent primary, slight highlight
- **Error:** Border error color
- **Disabled:** Reduced opacity

### 9.10.3 Track Item States

- **Default:** Background tertiary
- **Hover:** Background hover
- **Selected:** Background `#3a4a5a`, border `2px solid #6495ed`
- **Dragging:** Semi-transparent, following cursor
- **Drop target:** Highlighted insertion point

## 9.11 Accessibility Considerations

### 9.11.1 Keyboard Navigation

- **Tab:** Navigate between interactive elements
- **Enter/Space:** Activate buttons, select items
- **Arrow keys:** Navigate lists (future enhancement)
- **Ctrl+Z/Y:** Undo/Redo (standard shortcuts)
- **Escape:** Close modals

### 9.11.2 Visual Feedback

- **Focus indicators:** Visible outline on focused elements
- **Hover states:** Clear visual feedback on all interactive elements
- **Loading states:** Clear indication of processing
- **Error states:** Clear error messages and visual indicators

### 9.11.3 Color Contrast

- **Text contrast:** Meets WCAG AA standards (4.5:1 for normal text)
- **Interactive elements:** Clear distinction from non-interactive
- **State indicators:** Color + shape/icon for colorblind accessibility

## 9.12 Language and Localization

### 9.12.1 Language Support

- **Primary language:** Russian
- **All UI text:** Russian
- **Tooltips:** Russian
- **Error messages:** Russian
- **Notifications:** Russian

### 9.12.2 Text Content

- **Button labels:** Icons with tooltips (no text labels)
- **Tooltips:** Full descriptions in Russian
- **Placeholders:** English (e.g., "Search...")
- **Empty states:** Russian messages

---

# 10. Future Enhancements (Roadmap-Ready)

## 10.1 Playlist Management Features

- **Total Duration Display** (Implemented)
  - Display total duration of all tracks in the playlist header
  - Format: "H:MM:SS" (e.g., "2:34:15")
  - Updates dynamically when tracks are added/removed/moved
  - Implementation: `duration` field in `Track` type, extracted using `music-metadata` library via IPC handler `audio:getDuration`
  - Utility functions: `formatDuration()` for formatting, `calculateTotalDuration()` for summing

- **Individual Track Duration Display** (Implemented)
  - Display duration of each track in a separate column
  - Format: "M:SS" (e.g., "3:45")
  - Shows "--:--" if duration is not available
  - Duration is extracted when track is added to playlist

- **Track Selection and Batch Operations** (Implemented)
  - Multiple selection methods:
    - Checkbox selection (click checkbox to toggle)
    - Click on track item to select
    - Ctrl+Click to toggle individual track selection
    - Shift+Click to select range from last selected to current
  - Visual highlighting: selected tracks have different background color (`#3a4a5a`) and border (`2px solid #6495ed`)
  - Batch operations:
    - "Select All" button in playlist header
    - "Delete Selected" button to remove all selected tracks
  - Implementation: `selectedTrackIds: Set<string>` in `playlistStore` for efficient lookup, selection actions, and batch move/delete operations

### 9.3.3 Demo Player Strip

- **Location:** Always visible in the top-most row of `AppHeader`.
- **Layout:**
  - Left block: Play/Pause button, track title (ellipsis if long), "Show in browser" button.
  - Middle block: timeline slider with current time on the left and total duration on the right.
  - Right block: volume slider (0–100%).
- **Behavior:**
  - Play/Pause toggles based on `demoPlayerStore.status`.
  - Timeline click/drag invokes `seek`.
  - If playback errors occur, the control surface disables and shows notification.
  - When no track selected, controls are disabled and placeholder "No active track" is shown.

## 10.2 Export Features

- **AIMP Playlist Export with Relative Paths** (Implemented)
  - Export format: M3U8 (UTF-8 encoded M3U) for mobile AIMP compatibility
  - Export process:
    1.  User selects target folder via dialog
    2.  Subfolder created with playlist name
    3.  All tracks copied to subfolder with original filenames
    4.  M3U8 playlist file created in same subfolder
    5.  Playlist uses relative paths (e.g., `track1.mp3`) pointing to tracks in same folder
  - Implementation: `AIMPPlaylistStrategy` export strategy, `getRelativePath()` utility function, IPC handler `export:aimp`
  - Benefits: Entire folder can be moved to any location (including mobile devices) without breaking paths

## 10.3 Other Planned Features

- Audio preview player
- Metadata scanner/importer
- Tagging system
- BPM/Key analysis
- Auto-sorting algorithms
- Cloud sync (Dropbox/Drive)
- Playlist-to-streaming import (Spotify/Beatport)
- Machine learning suggestions
- Multi-playlist editing mode

---

# 11. Non-Functional Requirements

## Performance

- UI reactivity \< 16ms frame time.
- Export speed: limited by disk I/O.

## Reliability

- No destructive file operations.
- Exported tracks always copied, never moved.
- JSON corruption protection.

## Portability

- Windows (primary)
- macOS/Linux (secondary)

---

# 11.1 Performance Best Practices

## Memoization

Heavy computations should be memoized to avoid unnecessary recalculations. For example, total playlist duration calculation should use `useMemo` with dependency on the tracks array.

## Debouncing

User input operations (e.g., search) should be debounced to reduce unnecessary operations. `useMemo` with `debounce` function is used to delay search execution.

## Event Handler Stability

Event handlers in `useEffect` dependencies should be stable to avoid unnecessary re-registrations. `useCallback` is used to create stable function references, which are then used in `useEffect` for registering/unregistering event handlers.

## List Rendering Optimization

For large lists, consider virtualization or pagination:

- Playlists and collections support unlimited tracks
- For very large lists, consider implementing virtual scrolling

## Async Operations

- Use proper error handling for async operations
- Implement loading states to provide user feedback
- Consider batching operations when possible

---

# 12. Security Considerations

## 12.1 Electron Security Configuration

The application implements multiple layers of security:

- **Context Isolation**: Enabled (`contextIsolation: true`) to isolate the main world context from the isolated world context
- **Node Integration**: Disabled (`nodeIntegration: false`) in renderer process to prevent direct Node.js API access
- **Preload Script**: Used to safely expose limited IPC API to renderer process via `contextBridge`
- **IPC Whitelisting**: All IPC channels are whitelisted in preload script (`electron/preload.ts`)
- **Content Security Policy**: Configured in `index.html` to restrict resource loading

## 12.2 Path Validation

### Current Implementation

Path validation is implemented in `electron/utils/fsHelpers.ts` via the `validatePath()` function. This function:

- Validates that the path is a non-empty string
- Resolves and normalizes the path using `path.resolve()`
- If `basePath` is provided, ensures the resolved path is within the base path using `path.relative()`
- Blocks paths that resolve outside the base path (detected by `..` in relative path or absolute relative path)

### Security Requirements

**Critical Requirement**: When `basePath` is not provided, paths containing `..` should be blocked to prevent path traversal attacks. The current implementation allows `..` in paths when `basePath` is not specified, which could be a security vulnerability.

**Required Fix**: The `validatePath()` function should block paths with `..` when `basePath` is not provided. The check should be performed at the beginning of the function: if `basePath` is not specified and the path contains `..` or `~`, the function should return false.

### File Existence Validation

**Requirement**: Before performing file operations (copy, read, etc.), the code should verify that source files exist using `fs.access()` or `fs.stat()`. This provides better error handling and prevents unnecessary operations.

**Current Status**: Some handlers check file existence (e.g., `audio:getDuration`), but export functions do not verify source file existence before copying.

## 12.3 IPC Channel Security

All IPC channels are whitelisted in `electron/preload.ts`. Only channels in the `validChannels` array can be invoked from the renderer process. Any attempt to use a non-whitelisted channel will result in a rejected promise.

## 12.4 Content Security Policy

Content Security Policy (CSP) is configured in `index.html` via meta tag with http-equiv="Content-Security-Policy". The policy restricts:

- Scripts to same origin and inline scripts (required for Vite)
- Styles to same origin, inline styles, and Google Fonts
- Fonts to same origin and Google Fonts
- All other resources to same origin only

## 12.5 Plugin Security

- Plugins are sandboxed (implementation pending)
- No network access by default
- Plugin API is restricted to safe operations only

---

# 13. Error Handling

## 13.1 Error Handling Strategy

All IPC calls and file operations should implement proper error handling. For example, playlist export function should process each track in a loop with try-catch, collect errors and successful operations in separate arrays, return an object with fields success, successful, errors.

## 13.2 Common Error Types

- **FileNotFoundError**: Source file doesn't exist
- **PermissionDeniedError**: No write access to target directory
- **DiskFullError**: Insufficient disk space
- **InvalidPathError**: Path traversal or invalid characters
- **IPCError**: Communication failure between processes

## 13.3 User-Facing Error Messages

Errors should be displayed to users via notifications. A try-catch block is used: on success, a 'success' notification is shown, on error - an 'error' notification with error message via `useUIStore.getState().addNotification()`.

## 13.4 Error Handling Best Practices

### Standardized Error Response Format

All IPC handlers should return a standardized response format: an object with fields `success` (boolean), `data` (optional data), `error` (optional error message).

### Error Type Enumeration

It is recommended to create an enum for error types to standardize error messages: FILE_NOT_FOUND, PERMISSION_DENIED, DISK_FULL, INVALID_PATH, IPC_ERROR.

### Error Logging

Errors should be logged for debugging, especially in development mode. The check `process.env.NODE_ENV === 'development'` should be used for conditional logging.

### Graceful Degradation

Operations should fail gracefully, allowing partial success when possible. For example, export should continue even if some files failed to copy, showing a notification about failed files, but not interrupting the entire operation.

### Validation Before Operations

Always validate input data and check prerequisites before performing operations. For example, check file existence via `fs.access()` before copying.

---

# 13.5 Logging Strategy

## Current Implementation

**Location**: `src/shared/utils/logger.ts`

A centralized logging system is **already implemented** in the application. The `Logger` class provides structured logging with environment awareness.

### Logger Class

The `Logger` class implements the following methods:

- `debug(message: string, ...args: unknown[]): void` - Debug messages (development only)
- `info(message: string, ...args: unknown[]): void` - Informational messages (development only)
- `warn(message: string, ...args: unknown[]): void` - Warning messages (always logged)
- `error(message: string, error?: Error | unknown, ...args: unknown[]): void` - Error messages (always logged)

### Environment Awareness

- **Development** (`NODE_ENV === 'development'`): All log levels (`debug`, `info`, `warn`, `error`) are visible in console
- **Production**: Only `warn` and `error` are logged to console

### Usage

The logger is exported as a singleton instance:

```typescript
import { logger } from '@shared/utils/logger';

logger.debug('Debug information', { context: 'some data' });
logger.info('Informational message');
logger.warn('Warning message');
logger.error('Error message', error);
```

### Implementation Details

- Logs are prefixed with log level: `[DEBUG]`, `[INFO]`, `[WARN]`, `[ERROR]`
- Error objects are properly handled and logged with stack traces
- In production, error tracking service integration (e.g., Sentry) can be added to the `error()` method

### Future Enhancements

- File-based logging with log rotation
- Integration with error tracking services (e.g., Sentry) for production
- Structured logging format (JSON) for better parsing

---

# 13.6 Known Issues and Future Improvements

## Known Issues

Key issues identified during code review include:

### Critical Issues

1. **Path Validation Vulnerability**: `validatePath()` function should block paths with `..` when `basePath` is not provided
2. **Missing File Existence Check**: Export functions should verify source file existence before copying

### Medium Priority Issues

3. **Potential Memory Leak**: Keyboard event handler dependencies could cause unnecessary re-registrations
4. **Race Condition**: Track duration loading might update deleted tracks

### Low Priority Issues

6. **Console.error Usage**: Some direct `console.error` usage may still exist in legacy code (should be migrated to `logger.error()`)
7. **Incomplete Error Information**: Error information lost in `validatePath` catch block

## Future Improvements

### Performance Optimizations

- Implement memoization for heavy computations (e.g., total duration calculation)
- Add debounce for file search functionality
- Optimize event handler stability with `useCallback` or `useRef`

### Code Quality

- Extract constants to dedicated constants file (`src/constants/index.ts`)
- Migrate remaining direct `console.error` usage to `logger.error()`
- Improve error handling with standardized error types
- Add comprehensive test coverage for critical functions

### Accessibility

- Add ARIA attributes for better screen reader support
- Improve focus management
- Enhance keyboard navigation

### Features

- Additional export formats
- Audio preview player
- Metadata scanner/importer
- Tagging system
- BPM/Key analysis
- Auto-sorting algorithms
- Cloud sync capabilities
- Playlist-to-streaming import
- Machine learning suggestions
- Multi-playlist editing mode

---

# 14. Common Patterns

## 14.2 IPC Call Pattern

Standard pattern for IPC calls: wrapper function with try-catch block that calls `ipcService.invoke()`, logs errors via `console.error`, shows error notification via `useUIStore.getState().addNotification()`, and re-throws the error.

## 14.3 Store Update Pattern

Pattern for updating stores with validation: function validates input data (checks required fields), checks element existence (e.g., track already in playlist), shows info notification if element already exists, adds element to store and shows success notification.

---

# 15. Development Workflow

## 15.1 Setup Commands

Main commands: `npm install` for installing dependencies, `npm run dev` for development mode, `npm run build` for building production version, `npm run package` for packaging the application.

## 15.2 Project Structure

Project structure: root folder CherryPlayList contains electron/ (main.ts, preload.ts, ipc/, utils/), src/ (components/, state/, services/, types/, hooks/, index.tsx), public/, package.json.

## 15.3 TypeScript Configuration

Ensure `tsconfig.json` includes:

- Strict mode enabled
- Path aliases for clean imports
- Separate configs for main and renderer processes

---

# 15.4 Testing Strategy

## Current Testing Setup

The project uses Jest for unit testing with the following configuration:

- **Test Framework**: Jest with `ts-jest` for TypeScript support
- **Test Environment**: `jest-environment-jsdom` for React component testing
- **Testing Library**: `@testing-library/react` and `@testing-library/jest-dom` for React component testing
- **Test Location**: Tests are located in `tests/` directory

## Testing Approach

### Unit Tests

Unit tests should cover:

- **State Management**: Test Zustand stores (playlistStore, historyStore, etc.)
- **Utility Functions**: Test pure functions (durationUtils, trackFactory, etc.)
- **Hooks**: Test custom React hooks (usePlaylistDragAndDrop, useTrackDuration, etc.)

### Integration Tests

Integration tests should cover:

- **IPC Communication**: Test IPC handlers and service layer
- **File Operations**: Test file operations with mock file system
- **Export Functionality**: Test export strategies with test data

### Component Tests

Component tests should cover:

- **User Interactions**: Test drag-and-drop, selection, keyboard shortcuts
- **State Updates**: Test component state changes and store updates
- **Error Handling**: Test error states and error messages

## Test Coverage Goals

- **Critical Functions**: 100% coverage for security-critical functions (path validation, file operations)
- **State Management**: High coverage for store logic
- **Utilities**: High coverage for utility functions
- **Components**: Moderate coverage focusing on user interactions

## Testing Best Practices

### Test Structure

Tests are structured according to Arrange-Act-Assert pattern: describe block for grouping function tests, separate it blocks for normal case, edge cases and error cases. Each test contains Arrange (data preparation), Act (function execution), Assert (result verification).

### Mocking

- Mock IPC calls in component tests
- Mock file system operations in integration tests
- Use `jest.mock()` for external dependencies

### Test Data

- Use test utilities (`tests/testUtils.ts`) for creating test data
- Keep test data minimal and focused
- Use factories for complex test objects

## Future Testing Improvements

- Add E2E tests using Playwright or similar
- Increase test coverage for components
- Add visual regression testing
- Add performance testing for large playlists
- Add accessibility testing

---

# 16. Glossary

- **Track Source** --- a panel that provides tracks to drag into
  playlist.
- **Export Strategy** --- pluggable module for saving playlists.
- **Zustand Store** --- global reactive state module.
- **Playlist** --- ordered list of track objects.

---

# END
