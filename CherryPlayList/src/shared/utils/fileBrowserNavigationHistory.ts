export const normalizeFileBrowserPath = (path: string): string => {
  const trimmed = path.trim().replace(/\\/g, '/');
  const driveRoot = /^([A-Za-z]):\/?$/.exec(trimmed);
  if (driveRoot) {
    return `${driveRoot[1]}:/`;
  }
  return trimmed;
};

export type FileBrowserNavState = {
  readonly entries: readonly string[];
  readonly index: number;
};

export const createFileBrowserNavState = (initialPath: string): FileBrowserNavState => {
  return { entries: [normalizeFileBrowserPath(initialPath)], index: 0 };
};

export const pushFileBrowserPath = (
  state: FileBrowserNavState,
  nextPath: string,
): FileBrowserNavState => {
  const next = normalizeFileBrowserPath(nextPath);
  const current = normalizeFileBrowserPath(state.entries[state.index] ?? '');
  if (current === next) {
    return state;
  }
  const entries = [...state.entries.slice(0, state.index + 1), next];
  return { entries, index: entries.length - 1 };
};

export const goBackInFileBrowserHistory = (state: FileBrowserNavState): FileBrowserNavState => {
  if (state.index <= 0) {
    return state;
  }
  return { ...state, index: state.index - 1 };
};
