import type { Layout } from '@core/types/layout';

let getActiveLayoutSnapshot: (() => Layout) | null = null;

export function registerActiveLayoutGetter(getter: () => Layout): void {
  getActiveLayoutSnapshot = getter;
}

export function getActiveLayoutSnapshotForFocus(): Layout | null {
  return getActiveLayoutSnapshot?.() ?? null;
}
