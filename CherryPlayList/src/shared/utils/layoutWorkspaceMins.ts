import { workspaceRegistry } from '@core/registry';
import type { ContainerZone, Layout, SplitDirection, Zone } from '@core/types/layout';

import { logger } from './logger';

export interface WorkspaceMinSize {
  minWidth: number;
  minHeight: number;
}

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

export const normalizeWorkspaceType = (workspaceType: string): string => {
  return workspaceType === 'aimp' ? 'player' : workspaceType;
}

export const getWorkspaceMinSize = (workspaceType: string): WorkspaceMinSize => {
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

export const getAllRegisteredWorkspaceTypesWithMins = (): WorkspaceTypeWithMins[] => {
  return workspaceRegistry.getAllModulesByType().map((module) => ({
    type: module.type,
    minWidth: module.minWidth,
    minHeight: module.minHeight,
  }));
}

const getMinAlongSplitAxis = (size: WorkspaceMinSize, direction: SplitDirection): number => {
  return direction === 'horizontal' ? size.minWidth : size.minHeight;
}

const getMinAlongCrossAxis = (size: WorkspaceMinSize, direction: SplitDirection): number => {
  return direction === 'horizontal' ? size.minHeight : size.minWidth;
}

const getChildMinPixelsAlongSplitAxis = (child: Zone, direction: SplitDirection): number => {
  const childSize = computeMinLayoutSize(child);
  return getMinAlongSplitAxis(childSize, direction);
}

export const computeMinLayoutSize = (rootZone: Zone): WorkspaceMinSize => {
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

export const getMinSizePercentsForContainer = (
  containerZone: ContainerZone,
  containerPixelWidth: number,
  containerPixelHeight: number,
): number[] => {
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

const roundPx = (value: number): number => {
  return Math.round(value * 100) / 100;
}

export const explainMinLayoutSize = (
  rootZone: Zone,
  depth = 0,
): { size: WorkspaceMinSize; lines: string[] } => {
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

export const computeMinWindowSize = (layout: Layout, chrome: WindowChromeInsets): WorkspaceMinSize => {
  const layoutMins = computeMinLayoutSize(layout.rootZone);

  return {
    minWidth: chrome.left + chrome.right + layoutMins.minWidth,
    minHeight: chrome.top + chrome.bottom + layoutMins.minHeight,
  };
}
