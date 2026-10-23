export interface LayoutViewportSize {
  width: number;
  height: number;
}

let getLayoutViewport: (() => LayoutViewportSize | null) | null = null;

export const registerLayoutViewportGetter = (getter: () => LayoutViewportSize | null): void => {
  getLayoutViewport = getter;
};

export const getCurrentLayoutViewport = (): LayoutViewportSize | null => {
  return getLayoutViewport?.() ?? null;
};
