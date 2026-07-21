import { workspaceRegistry } from '@core/registry';
import type { ContainerZone, Layout, SplitDirection, Zone } from '@core/types/layout';

import { logger } from './logger';

export interface WorkspaceMinSize {
  minWidth: number;
  minHeight: number;
}

/**
 * Conservative fallback used when a workspace type is not registered
 * or does not declare explicit mins.
 */
export const DEFAULT_WORKSPACE_MIN_SIZE: WorkspaceMinSize = {
  minWidth: 200,
  minHeight: 150,
};

export interface WindowChromeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Normalizes legacy/alias workspace types before registry lookup or zone
 * creation. `aimp` zones are treated as `player` (spec A7). Single source of
 * truth reused by layout operations so the alias mapping never diverges.
 */
export function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType === 'aimp' ? 'player' : workspaceType;
}

/**
 * Resolves the minimum content size (in pixels) for a workspace type via the
 * registry. `aimp` normalizes to `player`. Unknown types fall back to a
 * conservative default and emit a dev warning.
 */
export function getWorkspaceMinSize(workspaceType: string): WorkspaceMinSize {
  const normalizedType = normalizeWorkspaceType(workspaceType);
  const module = workspaceRegistry.getModuleByType(normalizedType);

  if (!module) {
    logger.warn(
      `[layoutWorkspaceMins] No registered module for workspace type "${workspaceType}". ` +
        `Falling back to default mins ${DEFAULT_WORKSPACE_MIN_SIZE.minWidth}x${DEFAULT_WORKSPACE_MIN_SIZE.minHeight}.`,
    );
    return { ...DEFAULT_WORKSPACE_MIN_SIZE };
  }

  return { minWidth: module.minWidth, minHeight: module.minHeight };
}

export interface WorkspaceTypeWithMins extends WorkspaceMinSize {
  type: string;
}

/**
 * Returns all registered workspace types with their declared mins.
 * Intended for documentation and tests.
 */
export function getAllRegisteredWorkspaceTypesWithMins(): WorkspaceTypeWithMins[] {
  return workspaceRegistry.getAllModulesByType().map((module) => ({
    type: module.type,
    minWidth: module.minWidth,
    minHeight: module.minHeight,
  }));
}

function getMinAlongSplitAxis(size: WorkspaceMinSize, direction: SplitDirection): number {
  return direction === 'horizontal' ? size.minWidth : size.minHeight;
}

function getMinAlongCrossAxis(size: WorkspaceMinSize, direction: SplitDirection): number {
  return direction === 'horizontal' ? size.minHeight : size.minWidth;
}

function getChildMinPixelsAlongSplitAxis(child: Zone, direction: SplitDirection): number {
  const childSize = computeMinLayoutSize(child);
  return getMinAlongSplitAxis(childSize, direction);
}

/**
 * Minimum layout viewport size at which the tree can be arranged so every
 * workspace leaf receives at least its declared `minWidth` × `minHeight`.
 *
 * Min-content model (dividers are adjustable): along a container's split axis
 * the minimum is the **sum** of child mins; along the cross axis it is the
 * **max** of child mins. Size fractions do not affect this minimum.
 */
export function computeMinLayoutSize(rootZone: Zone): WorkspaceMinSize {
  if (rootZone.type === 'workspace') {
    return getWorkspaceMinSize(rootZone.workspaceType);
  }

  if (rootZone.zones.length === 0) {
    return { minWidth: 0, minHeight: 0 };
  }

  const childSizes = rootZone.zones.map((child) => computeMinLayoutSize(child));

  const splitAxisMins = childSizes.map((childSize) =>
    getMinAlongSplitAxis(childSize, rootZone.direction),
  );

  const crossAxisMins = childSizes.map((childSize) =>
    getMinAlongCrossAxis(childSize, rootZone.direction),
  );

  const splitAxisTotal = splitAxisMins.reduce((sum, value) => sum + value, 0);
  const crossAxisMax = Math.max(...crossAxisMins, 0);

  if (rootZone.direction === 'horizontal') {
    return {
      minWidth: splitAxisTotal,
      minHeight: crossAxisMax,
    };
  }

  return {
    minWidth: crossAxisMax,
    minHeight: splitAxisTotal,
  };
}

/**
 * Per-sibling minimum percentages along a container's split axis, parallel to
 * `zones`. Uses current container pixel width/height for percent conversion.
 */
export function getMinSizePercentsForContainer(
  containerZone: ContainerZone,
  containerPixelWidth: number,
  containerPixelHeight: number,
): number[] {
  const splitAxisSize =
    containerZone.direction === 'horizontal' ? containerPixelWidth : containerPixelHeight;

  if (splitAxisSize <= 0) {
    return containerZone.zones.map(() => 0);
  }

  return containerZone.zones.map((child) => {
    const minPixels = getChildMinPixelsAlongSplitAxis(child, containerZone.direction);
    return (minPixels / splitAxisSize) * 100;
  });
}

function roundPx(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Human-readable breakdown of `computeMinLayoutSize`, exposing the recursion for
 * both axes (width and height). Returned `lines` are indented per depth so the
 * console output mirrors the layout tree; `size` matches `computeMinLayoutSize`.
 */
export function explainMinLayoutSize(
  rootZone: Zone,
  depth = 0,
): { size: WorkspaceMinSize; lines: string[] } {
  const indent = '  '.repeat(depth);

  if (rootZone.type === 'workspace') {
    const size = getWorkspaceMinSize(rootZone.workspaceType);
    return {
      size,
      lines: [
        `${indent}• workspace "${rootZone.workspaceType}" → minWidth=${size.minWidth}px, minHeight=${size.minHeight}px`,
      ],
    };
  }

  if (rootZone.zones.length === 0) {
    return {
      size: { minWidth: 0, minHeight: 0 },
      lines: [`${indent}• container (пустой) → minWidth=0px, minHeight=0px`],
    };
  }

  const isHorizontal = rootZone.direction === 'horizontal';
  const axisLabel = isHorizontal ? 'горизонтальный (делит ширину)' : 'вертикальный (делит высоту)';
  const lines: string[] = [`${indent}▸ container ${axisLabel}, зон: ${rootZone.zones.length}`];

  const childResults = rootZone.zones.map((child) => explainMinLayoutSize(child, depth + 1));
  const childAxisLabel = isHorizontal ? 'minWidth' : 'minHeight';

  const splitAxisMins = childResults.map((childResult, index) => {
    const childMin = getMinAlongSplitAxis(childResult.size, rootZone.direction);

    lines.push(...childResult.lines);
    lines.push(
      `${indent}  ↳ зона[${index}] ${childAxisLabel}=${roundPx(childMin)}px (вклад в ось split)`,
    );

    return childMin;
  });

  const crossAxisMins = childResults.map((childResult) =>
    getMinAlongCrossAxis(childResult.size, rootZone.direction),
  );

  const splitAxisTotal = splitAxisMins.reduce((sum, value) => sum + value, 0);
  const crossAxisMax = Math.max(...crossAxisMins, 0);

  const size: WorkspaceMinSize = isHorizontal
    ? { minWidth: splitAxisTotal, minHeight: crossAxisMax }
    : { minWidth: crossAxisMax, minHeight: splitAxisTotal };

  const splitSumExpr = splitAxisMins.map((value) => `${roundPx(value)}px`).join(' + ');
  const crossMaxExpr = crossAxisMins.map((value) => `${roundPx(value)}px`).join(', ');

  if (isHorizontal) {
    lines.push(
      `${indent}∑ ширина = сумма минимумов = ${splitSumExpr} = ${roundPx(
        splitAxisTotal,
      )}px; высота = max(${crossMaxExpr}) = ${roundPx(crossAxisMax)}px`,
    );
  } else {
    lines.push(
      `${indent}∑ высота = сумма минимумов = ${splitSumExpr} = ${roundPx(
        splitAxisTotal,
      )}px; ширина = max(${crossMaxExpr}) = ${roundPx(crossAxisMax)}px`,
    );
  }

  return { size, lines };
}

/**
 * Minimum browser window size = layout viewport mins plus chrome insets.
 */
export function computeMinWindowSize(layout: Layout, chrome: WindowChromeInsets): WorkspaceMinSize {
  const layoutMins = computeMinLayoutSize(layout.rootZone);

  return {
    minWidth: chrome.left + chrome.right + layoutMins.minWidth,
    minHeight: chrome.top + chrome.bottom + layoutMins.minHeight,
  };
}
