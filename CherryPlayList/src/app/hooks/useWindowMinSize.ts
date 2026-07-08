import { useEffect, type RefObject } from 'react';

import type { Layout } from '@core/types/layout';
import { APP_MIN_WINDOW_WIDTH, APP_MIN_WINDOW_HEIGHT } from '@shared/contracts/windowMins';
import { getAppMode } from '@shared/platform';
import { ipcService } from '@shared/services/ipcService';
import { useLayoutStore } from '@shared/stores';
import { computeMinWindowSize, type WindowChromeInsets } from '@shared/utils';
import {
  registerLayoutViewportGetter,
  type LayoutViewportSize,
} from '@shared/utils/layoutViewportBridge';
import { logger } from '@shared/utils/logger';

/**
 * Absolute lower bound for the window minimum, used as `max(appFloor, computed)`
 * so empty/small layouts still keep a usable window size.
 *
 * Sourced from the shared window-min contract (`@shared/contracts/windowMins`),
 * the same module the Electron main-process floor is built from, so the renderer
 * and main can never drift apart.
 */
const APP_WINDOW_MIN_FLOOR: LayoutViewportSize = {
  width: APP_MIN_WINDOW_WIDTH,
  height: APP_MIN_WINDOW_HEIGHT,
};

const RESIZE_DEBOUNCE_MS = 120;

function measureLayoutViewport(host: HTMLElement | null): LayoutViewportSize | null {
  if (!host) {
    return null;
  }

  const rect = host.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return { width: rect.width, height: rect.height };
}

function measureChromeInsets(host: HTMLElement | null): WindowChromeInsets {
  const viewport = measureLayoutViewport(host);
  if (!viewport) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  return {
    top: Math.max(0, window.innerHeight - viewport.height),
    bottom: 0,
    left: Math.max(0, window.innerWidth - viewport.width),
    right: 0,
  };
}

/**
 * Computes the minimum window client size from the current layout mins plus
 * measured chrome insets and reports it to the Electron shell. Also registers a
 * live layout-viewport getter used by add-adjacent feasibility checks.
 *
 * Recomputes on layout change, layout-edit toggle, window resize, and host
 * resize (which captures chrome-affecting toggles such as the in-app player
 * header or the demo banner). No-op outside Electron.
 */
export function useWindowMinSize(hostRef: RefObject<HTMLElement | null>): void {
  const layout = useLayoutStore((state) => state.layout);
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);

  useEffect(() => {
    const host = hostRef.current;

    registerLayoutViewportGetter(() => measureLayoutViewport(hostRef.current));

    if (getAppMode() !== 'electron') {
      return () => registerLayoutViewportGetter(() => null);
    }

    const currentLayout: Layout = layout;

    const sendMinWindowSize = (): void => {
      const chrome = measureChromeInsets(hostRef.current);
      const computed = computeMinWindowSize(currentLayout, chrome);

      const minWidth = Math.ceil(Math.max(APP_WINDOW_MIN_FLOOR.width, computed.minWidth));
      const minHeight = Math.ceil(Math.max(APP_WINDOW_MIN_FLOOR.height, computed.minHeight));

      void ipcService.setMinimumWindowSize(minWidth, minHeight).catch((error: unknown) => {
        logger.warn('[useWindowMinSize] Failed to set minimum window size', error);
      });
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleUpdate = (): void => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(sendMinWindowSize, RESIZE_DEBOUNCE_MS);
    };

    sendMinWindowSize();

    window.addEventListener('resize', scheduleUpdate);

    let resizeObserver: ResizeObserver | null = null;
    if (host && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(host);
    }

    return () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
      registerLayoutViewportGetter(() => null);
    };
    // `isLayoutEditMode` is a dependency because toggling layout-edit mode shows/hides
    // edit chrome (air bars, controls), which changes measured chrome insets and thus
    // the reported minimum window size; recompute when it changes.
  }, [hostRef, layout, isLayoutEditMode]);
}
