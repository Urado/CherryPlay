export interface LayoutViewportSize {
  width: number;
  height: number;
}

let getLayoutViewport: (() => LayoutViewportSize | null) | null = null;

/**
 * Registers a getter that measures the current layout host viewport (pixels).
 * Wired from the renderer window-min hook so pure layout operations (add-adjacent
 * feasibility) can read the live viewport without direct DOM access.
 */
export function registerLayoutViewportGetter(getter: () => LayoutViewportSize | null): void {
  getLayoutViewport = getter;
}

export function getCurrentLayoutViewport(): LayoutViewportSize | null {
  return getLayoutViewport?.() ?? null;
}
