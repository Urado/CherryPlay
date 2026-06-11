/**
 * Stack + index navigation for the file browser (Back = history, Up = parent is handled separately with push).
 * When the user navigates to a new path from the current point, forward history is trimmed (browser-like).
 */

/** Canonical form for nav stack + comparisons: trim, `/` separators, Windows drive root as `X:/`. */
export function normalizeFileBrowserPath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, '/');
  const driveRoot = /^([A-Za-z]):\/?$/.exec(trimmed);
  if (driveRoot) {
    return `${driveRoot[1]}:/`;
  }
  return trimmed;
}

export type FileBrowserNavState = {
  readonly entries: readonly string[];
  readonly index: number;
};

export function createFileBrowserNavState(initialPath: string): FileBrowserNavState {
  return { entries: [normalizeFileBrowserPath(initialPath)], index: 0 };
}

export function pushFileBrowserPath(
  state: FileBrowserNavState,
  nextPath: string,
): FileBrowserNavState {
  const next = normalizeFileBrowserPath(nextPath);
  const current = normalizeFileBrowserPath(state.entries[state.index] ?? '');
  if (current === next) {
    return state;
  }
  const entries = [...state.entries.slice(0, state.index + 1), next];
  return { entries, index: entries.length - 1 };
}

export function goBackInFileBrowserHistory(state: FileBrowserNavState): FileBrowserNavState {
  if (state.index <= 0) {
    return state;
  }
  return { ...state, index: state.index - 1 };
}
