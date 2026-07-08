/**
 * App-level floor for the main window minimum size (pixels).
 *
 * Single source of truth shared across bundles:
 * - Electron main (`electron/ipc/system.ts`, `electron/main.ts`) applies it as the
 *   `BrowserWindow` minimum and clamps any renderer-provided minimum to it.
 * - Renderer (`src/app/hooks/useWindowMinSize.ts`) uses it as the lower bound in
 *   `max(appFloor, layout-computed mins)`.
 *
 * Invariant: the renderer floor and the main-process floor must stay identical.
 * Keeping the value here (imported by both) prevents the previously duplicated
 * 800x600 constants from drifting apart.
 */
export const APP_MIN_WINDOW_WIDTH = 800;
export const APP_MIN_WINDOW_HEIGHT = 600;
