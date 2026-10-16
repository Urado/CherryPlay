import { MAX_LAYOUT_DEPTH, MAX_ZONES_PER_CONTAINER } from '@core/constants/layoutConstraints';

import { Zone, ContainerZone, ZoneId, SplitDirection } from '../../core/types/layout';

import { getMinSizePercentsForContainer } from './layoutWorkspaceMins';

export const findZoneById = (root: Zone, targetId: ZoneId): Zone | null => {
  if (root.id === targetId) {
    return root;
  }

  if (root.type === 'container') {
    for (const child of root.zones) {
      const found = findZoneById(child, targetId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export const findParentZone = (
  root: Zone,
  targetId: ZoneId,
  parent: ContainerZone | null = null,
): ContainerZone | null => {
  if (root.id === targetId) {
    return parent;
  }

  if (root.type === 'container') {
    for (const child of root.zones) {
      const found = findParentZone(child, targetId, root);
      if (found !== null) {
        return found;
      }
    }
  }

  return null;
}

export const countZones = (root: Zone): number => {
  if (root.type === 'workspace') {
    return 1;
  }

  return 1 + root.zones.reduce((sum, zone) => sum + countZones(zone), 0);
}

export const calculateMinSizePercent = (containerSize: number): number => {
  if (containerSize <= 0) {
    return 0;
  }
  return (10 / containerSize) * 100;
}

export const updateZoneInTree = (root: Zone, zoneId: ZoneId, updated: Zone): Zone => {
  if (root.id === zoneId) {
    return updated;
  }

  if (root.type === 'container') {
    return {
      ...root,
      zones: root.zones.map((child) => updateZoneInTree(child, zoneId, updated)),
    };
  }

  return root;
}

export const replaceZoneInTree = updateZoneInTree;

export const updateContainerInTree = (
  root: Zone,
  containerId: ZoneId,
  updated: ContainerZone,
): Zone => {
  return updateZoneInTree(root, containerId, updated);
}

export const getMaxDepth = (root: Zone, currentDepth: number = 0): number => {
  if (root.type === 'workspace') {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const child of root.zones) {
    const childDepth = getMaxDepth(child, currentDepth + 1);
    maxDepth = Math.max(maxDepth, childDepth);
  }

  return maxDepth;
}

export const validateLayout = (
  root: Zone,
  containerWidth: number,
  containerHeight: number,
): boolean => {
  const maxDepth = getMaxDepth(root);
  if (maxDepth > MAX_LAYOUT_DEPTH) {
    return false;
  }

  const validateZone = (zone: Zone, _parentDirection?: SplitDirection): boolean => {
    if (zone.type === 'workspace') {
      if (zone.size < 0 || zone.size > 100) {
        return false;
      }
      return true;
    }

    if (zone.zones.length < 2) {
      return false;
    }

    if (zone.zones.length > MAX_ZONES_PER_CONTAINER) {
      return false;
    }

    const totalSize = zone.sizes.reduce((sum, size) => sum + size, 0);
    if (Math.abs(totalSize - 100) > 0.01) {
      return false;
    }

    if (zone.sizes.length !== zone.zones.length) {
      return false;
    }

    const minPercents = getMinSizePercentsForContainer(zone, containerWidth, containerHeight);

    for (let index = 0; index < zone.sizes.length; index += 1) {
      if (zone.sizes[index] < minPercents[index]) {
        return false;
      }
    }

    for (const child of zone.zones) {
      if (!validateZone(child, zone.direction)) {
        return false;
      }
    }

    return true;
  };

  return validateZone(root);
}

export const cleanupContainers = (root: Zone): Zone => {
  if (root.type === 'workspace') {
    return root;
  }

  if (root.zones.length === 1) {
    const child = cleanupContainers(root.zones[0]);
    return child;
  }

  const cleanedZones = root.zones.map((zone) => cleanupContainers(zone));

  if (cleanedZones.length === 1) {
    return cleanedZones[0];
  }

  return {
    ...root,
    zones: cleanedZones,
  };
}

export const syncContainerChildSizes = (container: ContainerZone): ContainerZone => {
  return {
    ...container,
    zones: container.zones.map((zone, index) => {
      if (zone.type === 'workspace') {
        return { ...zone, size: container.sizes[index] };
      }
      return syncContainerChildSizes(zone);
    }),
  };
}
