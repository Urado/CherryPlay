import { v4 as uuidv4 } from 'uuid';

import { MAX_LAYOUT_DEPTH, MAX_ZONES_PER_CONTAINER } from '@core/constants/layoutConstraints';
import {
  DEFAULT_DEMO_PLAYER_WORKSPACE_ID,
  DEFAULT_FILEBROWSER_WORKSPACE_ID,
  DEFAULT_PLAYLIST_WORKSPACE_ID,
  DEFAULT_PLAYER_WORKSPACE_ID,
  PARTY_EDITOR_WORKSPACE_ID,
  PARTY_PREVIEW_WORKSPACE_ID,
  generateWorkspaceId,
} from '@core/constants/workspace';
import {
  ContainerZone,
  Layout,
  SplitDirection,
  WorkspaceZone,
  Zone,
  ZoneId,
} from '@core/types/layout';
import { WorkspaceId } from '@core/types/workspace';

import {
  cleanupContainers,
  findParentZone,
  findZoneById,
  getMaxDepth,
  replaceZoneInTree,
  updateContainerInTree,
} from './layoutUtils';
import type { LayoutViewportSize } from './layoutViewportBridge';
import {
  computeMinLayoutSize,
  explainMinLayoutSize,
  normalizeWorkspaceType,
} from './layoutWorkspaceMins';
import { logger } from './logger';

export type LayoutEditAirSide = 'top' | 'right' | 'bottom' | 'left';

const MIN_SIZE_FEASIBILITY_EPSILON = 0.5;

const SINGLETON_WORKSPACE_TYPES = new Set([
  'playlist',
  'player',
  'demo-player',
  'party-editor',
  'party-preview',
]);

const PLAYBACK_WORKSPACE_TYPES = new Set(['player', 'aimp']);

function isPlaybackWorkspaceType(workspaceType: string): boolean {
  return PLAYBACK_WORKSPACE_TYPES.has(workspaceType);
}

function getSplitDirection(side: LayoutEditAirSide): SplitDirection {
  return side === 'top' || side === 'bottom' ? 'vertical' : 'horizontal';
}

function isBeforeSide(side: LayoutEditAirSide): boolean {
  return side === 'top' || side === 'left';
}

export function countWorkspaceLeaves(root: Zone): number {
  if (root.type === 'workspace') {
    return 1;
  }

  return root.zones.reduce((sum, zone) => sum + countWorkspaceLeaves(zone), 0);
}

export function isLayoutEmpty(layout: Layout): boolean {
  return countWorkspaceLeaves(layout.rootZone) === 0;
}

export function createEmptyLayout(): Layout {
  const emptyRoot: ContainerZone = {
    id: uuidv4(),
    type: 'container',
    direction: 'horizontal',
    zones: [],
    sizes: [],
  };

  return {
    version: 1,
    rootZone: emptyRoot,
  };
}

export type AddInitialWorkspaceResult =
  | { ok: true; layout: Layout; preparedZone: WorkspaceZone }
  | {
      ok: false;
      reason: 'min_size_violation';
      minSizeDiagnostics?: AddAdjacentMinSizeDiagnostics;
    };

export function addInitialWorkspaceToLayout(
  workspaceType: string,
  currentLayoutViewport?: LayoutViewportSize | null,
): AddInitialWorkspaceResult {
  const zone = createWorkspaceZone(workspaceType);
  const result: AddInitialWorkspaceResult = {
    ok: true,
    layout: {
      version: 1,
      rootZone: zone,
    },
    preparedZone: zone,
  };

  return enforceMinSizeFeasibility(result, currentLayoutViewport);
}

export function collectWorkspaceTypes(root: Zone): Set<string> {
  if (root.type === 'workspace') {
    return new Set([root.workspaceType]);
  }

  const types = new Set<string>();
  for (const child of root.zones) {
    for (const type of collectWorkspaceTypes(child)) {
      types.add(type);
    }
  }

  return types;
}

export function collectWorkspaceZones(root: Zone): WorkspaceZone[] {
  if (root.type === 'workspace') {
    return [root];
  }

  return root.zones.flatMap(collectWorkspaceZones);
}

export function isSingletonWorkspaceType(workspaceType: string): boolean {
  return SINGLETON_WORKSPACE_TYPES.has(workspaceType) || isPlaybackWorkspaceType(workspaceType);
}

function layoutHasPlaybackWorkspace(types: Set<string>): boolean {
  return types.has('player') || types.has('aimp');
}

function migrateAimpZoneToPlayer(zone: Zone): Zone {
  if (zone.type === 'workspace' && zone.workspaceType === 'aimp') {
    return {
      ...zone,
      workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
      workspaceType: 'player',
    };
  }

  if (zone.type === 'container') {
    return {
      ...zone,
      zones: zone.zones.map(migrateAimpZoneToPlayer),
    };
  }

  return zone;
}

export function migrateAimpZonesToPlayerInLayout(layout: Layout): Layout {
  return {
    ...layout,
    rootZone: migrateAimpZoneToPlayer(layout.rootZone) as Layout['rootZone'],
  };
}

function migrateDuplicateFileBrowserZone(zone: Zone, seenDefaultId: { value: boolean }): Zone {
  if (zone.type === 'workspace' && zone.workspaceType === 'fileBrowser') {
    if (zone.workspaceId === DEFAULT_FILEBROWSER_WORKSPACE_ID) {
      if (!seenDefaultId.value) {
        seenDefaultId.value = true;
        return zone;
      }

      return {
        ...zone,
        workspaceId: generateWorkspaceId(),
      };
    }

    return zone;
  }

  if (zone.type === 'container') {
    return {
      ...zone,
      zones: zone.zones.map((child) => migrateDuplicateFileBrowserZone(child, seenDefaultId)),
    };
  }

  return zone;
}

export function migrateDuplicateFileBrowserWorkspaceIds(layout: Layout): Layout {
  const seenDefaultId = { value: false };

  return {
    ...layout,
    rootZone: migrateDuplicateFileBrowserZone(layout.rootZone, seenDefaultId) as Layout['rootZone'],
  };
}

export function resolveWorkspaceIdForType(workspaceType: string): WorkspaceId {
  switch (workspaceType) {
    case 'playlist':
      return DEFAULT_PLAYLIST_WORKSPACE_ID;
    case 'fileBrowser':
      return generateWorkspaceId();
    case 'player':
      return DEFAULT_PLAYER_WORKSPACE_ID;
    case 'demo-player':
      return DEFAULT_DEMO_PLAYER_WORKSPACE_ID;
    case 'aimp':
      return DEFAULT_PLAYER_WORKSPACE_ID;
    case 'party-editor':
      return PARTY_EDITOR_WORKSPACE_ID;
    case 'party-preview':
      return PARTY_PREVIEW_WORKSPACE_ID;
    default:
      return generateWorkspaceId();
  }
}

export function createWorkspaceZone(workspaceType: string): WorkspaceZone {
  const normalizedType = normalizeWorkspaceType(workspaceType);

  return {
    id: uuidv4(),
    type: 'workspace',
    workspaceId: resolveWorkspaceIdForType(normalizedType),
    workspaceType: normalizedType,
    size: 50,
  };
}

function buildSplitContainer(
  existingZone: Zone,
  newZone: WorkspaceZone,
  side: LayoutEditAirSide,
): ContainerZone {
  const zones = isBeforeSide(side) ? [newZone, existingZone] : [existingZone, newZone];

  return {
    id: uuidv4(),
    type: 'container',
    direction: getSplitDirection(side),
    zones,
    sizes: [50, 50],
  };
}

export interface AddAdjacentMinSizeDiagnostics {
  proposedRoot: Zone | null;
  viewport: LayoutViewportSize | null;
}

export type AddAdjacentWorkspaceResult =
  | { ok: true; layout: Layout; preparedZone: WorkspaceZone }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'depth_exceeded'
        | 'container_full'
        | 'duplicate_singleton'
        | 'invalid_side'
        | 'single_zone'
        | 'min_size_violation';
      minSizeDiagnostics?: AddAdjacentMinSizeDiagnostics;
    };

type MinSizeFeasibilityResult = AddAdjacentWorkspaceResult | AddInitialWorkspaceResult;

function enforceMinSizeFeasibility<T extends MinSizeFeasibilityResult>(
  result: T,
  currentLayoutViewport?: LayoutViewportSize | null,
): T {
  if (!result.ok) {
    return result;
  }

  if (currentLayoutViewport === undefined) {
    return result;
  }

  if (currentLayoutViewport === null) {
    return {
      ok: false,
      reason: 'min_size_violation',
      minSizeDiagnostics: { proposedRoot: null, viewport: null },
    } as T;
  }

  const proposedMins = computeMinLayoutSize(result.layout.rootZone);
  const fitsWidth =
    proposedMins.minWidth <= currentLayoutViewport.width + MIN_SIZE_FEASIBILITY_EPSILON;
  const fitsHeight =
    proposedMins.minHeight <= currentLayoutViewport.height + MIN_SIZE_FEASIBILITY_EPSILON;

  if (!fitsWidth || !fitsHeight) {
    return {
      ok: false,
      reason: 'min_size_violation',
      minSizeDiagnostics: {
        proposedRoot: result.layout.rootZone,
        viewport: currentLayoutViewport,
      },
    } as T;
  }

  return result;
}

export function logAddAdjacentMinSizeViolation(
  result: AddAdjacentWorkspaceResult | AddInitialWorkspaceResult,
): void {
  if (result.ok || result.reason !== 'min_size_violation') {
    return;
  }

  const diagnostics = result.minSizeDiagnostics ?? { proposedRoot: null, viewport: null };
  logMinSizeViolation(diagnostics.proposedRoot, diagnostics.viewport);
}

export function canAddAdjacentWorkspace(
  layout: Layout,
  targetZoneId: ZoneId,
  side: LayoutEditAirSide,
  workspaceTypes: string[],
  currentLayoutViewport?: LayoutViewportSize | null,
): boolean {
  return workspaceTypes.some(
    (workspaceType) =>
      addAdjacentWorkspaceToLayout(layout, targetZoneId, side, workspaceType, currentLayoutViewport)
        .ok,
  );
}

export function canAddAdjacentWorkspaceToContainer(
  layout: Layout,
  containerId: ZoneId,
  side: LayoutEditAirSide,
  workspaceTypes: string[],
  currentLayoutViewport?: LayoutViewportSize | null,
): boolean {
  return workspaceTypes.some(
    (workspaceType) =>
      addAdjacentWorkspaceToContainerLayout(
        layout,
        containerId,
        side,
        workspaceType,
        currentLayoutViewport,
      ).ok,
  );
}

export function canAddInitialWorkspace(
  workspaceType: string,
  currentLayoutViewport?: LayoutViewportSize | null,
): boolean {
  return addInitialWorkspaceToLayout(workspaceType, currentLayoutViewport).ok;
}

function logMinSizeViolation(proposedRoot: Zone | null, viewport: LayoutViewportSize | null): void {
  if (!proposedRoot || !viewport) {
    logger.warn(
      '[layout mins] Нельзя добавить workspace: размер области layout неизвестен (viewport=null), ' +
        'проверка минимальных размеров невозможна — операция отклонена.',
    );
    return;
  }

  const { size, lines } = explainMinLayoutSize(proposedRoot);
  const fitsWidth = size.minWidth <= viewport.width + MIN_SIZE_FEASIBILITY_EPSILON;
  const fitsHeight = size.minHeight <= viewport.height + MIN_SIZE_FEASIBILITY_EPSILON;

  const report = [
    '[layout mins] Нельзя добавить workspace — не хватает места при текущем размере окна.',
    `Текущая область layout: ${Math.round(viewport.width)}px × ${Math.round(viewport.height)}px (ширина × высота).`,
    'Требуемый минимум для предполагаемого дерева (рекурсивный расчёт):',
    ...lines,
    `Итог: требуется minWidth=${Math.round(size.minWidth)}px, minHeight=${Math.round(size.minHeight)}px.`,
    `По горизонтали: ${Math.round(size.minWidth)}px ≤ ${Math.round(viewport.width)}px → ${
      fitsWidth ? 'помещается' : 'НЕ ПОМЕЩАЕТСЯ'
    }.`,
    `По вертикали: ${Math.round(size.minHeight)}px ≤ ${Math.round(viewport.height)}px → ${
      fitsHeight ? 'помещается' : 'НЕ ПОМЕЩАЕТСЯ'
    }.`,
  ].join('\n');

  logger.warn(report);
}

export function getContainerSpanSides(direction: SplitDirection): LayoutEditAirSide[] {
  return direction === 'horizontal' ? ['top', 'bottom'] : ['left', 'right'];
}

export function isSpanSideForContainer(
  direction: SplitDirection,
  side: LayoutEditAirSide,
): boolean {
  return getContainerSpanSides(direction).includes(side);
}

function insertAdjacentZoneInLayout(
  layout: Layout,
  targetZoneId: ZoneId,
  targetZone: Zone,
  newZone: WorkspaceZone,
  side: LayoutEditAirSide,
): AddAdjacentWorkspaceResult {
  const splitDirection = getSplitDirection(side);
  const parent = findParentZone(layout.rootZone, targetZoneId);

  if (!parent) {
    const splitContainer = buildSplitContainer(targetZone, newZone, side);
    if (getMaxDepth(splitContainer) > MAX_LAYOUT_DEPTH) {
      return { ok: false, reason: 'depth_exceeded' };
    }

    return { ok: true, layout: { ...layout, rootZone: splitContainer }, preparedZone: newZone };
  }

  const targetIndex = parent.zones.findIndex((zone) => zone.id === targetZoneId);
  if (targetIndex === -1) {
    return { ok: false, reason: 'not_found' };
  }

  if (parent.direction === splitDirection) {
    if (parent.zones.length >= MAX_ZONES_PER_CONTAINER) {
      return { ok: false, reason: 'container_full' };
    }

    const insertIndex = isBeforeSide(side) ? targetIndex : targetIndex + 1;
    const newSizes = [...parent.sizes];
    const half = newSizes[targetIndex] / 2;
    newSizes[targetIndex] = half;
    newSizes.splice(insertIndex, 0, half);

    const newZones = [...parent.zones];
    newZones.splice(insertIndex, 0, newZone);

    const updatedParent: ContainerZone = {
      ...parent,
      zones: newZones,
      sizes: newSizes,
    };

    const nextRoot = updateContainerInTree(layout.rootZone, parent.id, updatedParent);
    if (getMaxDepth(nextRoot) > MAX_LAYOUT_DEPTH) {
      return { ok: false, reason: 'depth_exceeded' };
    }

    return {
      ok: true,
      layout: {
        ...layout,
        rootZone: nextRoot,
      },
      preparedZone: newZone,
    };
  }

  const splitContainer = buildSplitContainer(targetZone, newZone, side);
  const nextRoot = replaceZoneInTree(layout.rootZone, targetZoneId, splitContainer);
  if (getMaxDepth(nextRoot) > MAX_LAYOUT_DEPTH) {
    return { ok: false, reason: 'depth_exceeded' };
  }

  return {
    ok: true,
    layout: {
      ...layout,
      rootZone: nextRoot,
    },
    preparedZone: newZone,
  };
}

function validateSingletonWorkspaceType(
  layout: Layout,
  workspaceType: string,
): AddAdjacentWorkspaceResult | null {
  if (!isSingletonWorkspaceType(workspaceType)) {
    return null;
  }

  const types = collectWorkspaceTypes(layout.rootZone);
  if (isPlaybackWorkspaceType(workspaceType)) {
    if (layoutHasPlaybackWorkspace(types)) {
      return { ok: false, reason: 'duplicate_singleton' };
    }
  } else if (types.has(workspaceType)) {
    return { ok: false, reason: 'duplicate_singleton' };
  }

  return null;
}

export function addAdjacentWorkspaceToLayout(
  layout: Layout,
  targetZoneId: ZoneId,
  side: LayoutEditAirSide,
  workspaceType: string,
  currentLayoutViewport?: LayoutViewportSize | null,
): AddAdjacentWorkspaceResult {
  const targetZone = findZoneById(layout.rootZone, targetZoneId);
  if (!targetZone || targetZone.type !== 'workspace') {
    return { ok: false, reason: 'not_found' };
  }

  const singletonError = validateSingletonWorkspaceType(layout, workspaceType);
  if (singletonError) {
    return singletonError;
  }

  const normalizedType = normalizeWorkspaceType(workspaceType);
  const newZone = createWorkspaceZone(normalizedType);

  const result = insertAdjacentZoneInLayout(layout, targetZoneId, targetZone, newZone, side);
  return enforceMinSizeFeasibility(result, currentLayoutViewport);
}

export function addAdjacentWorkspaceToContainerLayout(
  layout: Layout,
  containerId: ZoneId,
  side: LayoutEditAirSide,
  workspaceType: string,
  currentLayoutViewport?: LayoutViewportSize | null,
): AddAdjacentWorkspaceResult {
  const container = findZoneById(layout.rootZone, containerId);
  if (!container || container.type !== 'container') {
    return { ok: false, reason: 'not_found' };
  }

  if (container.zones.length < 2) {
    return { ok: false, reason: 'single_zone' };
  }

  if (!isSpanSideForContainer(container.direction, side)) {
    return { ok: false, reason: 'invalid_side' };
  }

  const singletonError = validateSingletonWorkspaceType(layout, workspaceType);
  if (singletonError) {
    return singletonError;
  }

  const normalizedType = normalizeWorkspaceType(workspaceType);
  const newZone = createWorkspaceZone(normalizedType);

  const result = insertAdjacentZoneInLayout(layout, containerId, container, newZone, side);
  return enforceMinSizeFeasibility(result, currentLayoutViewport);
}

export type RemoveWorkspaceResult =
  | { ok: true; layout: Layout; removedZone: WorkspaceZone }
  | { ok: false; reason: 'not_found' };

export function removeWorkspaceFromLayout(layout: Layout, zoneId: ZoneId): RemoveWorkspaceResult {
  const zone = findZoneById(layout.rootZone, zoneId);
  if (!zone || zone.type !== 'workspace') {
    return { ok: false, reason: 'not_found' };
  }

  if (countWorkspaceLeaves(layout.rootZone) <= 1) {
    return { ok: true, layout: createEmptyLayout(), removedZone: zone };
  }

  const parent = findParentZone(layout.rootZone, zoneId);
  if (!parent) {
    return { ok: false, reason: 'not_found' };
  }

  const removedIndex = parent.zones.findIndex((child) => child.id === zoneId);
  if (removedIndex === -1) {
    return { ok: false, reason: 'not_found' };
  }

  const removedSize = parent.sizes[removedIndex];
  const updatedZones = parent.zones.filter((child) => child.id !== zoneId);
  const updatedSizes = parent.sizes.filter((_, index) => index !== removedIndex);
  const totalRemaining = updatedSizes.reduce((sum, size) => sum + size, 0);
  const redistributedSizes =
    totalRemaining > 0
      ? updatedSizes.map((size) => size + (removedSize * size) / totalRemaining)
      : updatedZones.map(() => 100 / updatedZones.length);

  const updatedParent: ContainerZone = {
    ...parent,
    zones: updatedZones,
    sizes: redistributedSizes,
  };

  const nextRoot = cleanupContainers(
    updateContainerInTree(layout.rootZone, parent.id, updatedParent),
  );

  return {
    ok: true,
    layout: {
      ...layout,
      rootZone: nextRoot,
    },
    removedZone: zone,
  };
}

export function getAddWorkspaceErrorMessage(
  reason: Extract<AddAdjacentWorkspaceResult, { ok: false }>['reason'],
): string {
  switch (reason) {
    case 'duplicate_singleton':
      return 'Этот workspace уже есть в layout';
    case 'container_full':
      return 'В контейнере уже максимум зон';
    case 'depth_exceeded':
      return 'Достигнута максимальная вложенность layout';
    case 'not_found':
      return 'Workspace не найден';
    case 'invalid_side':
      return 'Нельзя добавить workspace с этой стороны контейнера';
    case 'single_zone':
      return 'Нужно минимум две зоны в ряду';
    case 'min_size_violation':
      return 'Недостаточно места. Увеличьте окно или измените пропорции разделителями.';
    default:
      return 'Не удалось добавить workspace';
  }
}

export function getRemoveWorkspaceErrorMessage(
  reason: Extract<RemoveWorkspaceResult, { ok: false }>['reason'],
): string {
  switch (reason) {
    case 'not_found':
      return 'Workspace не найден';
    default:
      return 'Не удалось удалить workspace';
  }
}
