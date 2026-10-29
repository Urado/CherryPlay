import type { Layout } from '@core/types/layout';

let getActiveLayoutSnapshot: (() => Layout) | null = null;

export const registerActiveLayoutGetter = (getter: () => Layout): void => {
  getActiveLayoutSnapshot = getter;
};

export const getActiveLayoutSnapshotForFocus = (): Layout | null => {
  return getActiveLayoutSnapshot?.() ?? null;
};
