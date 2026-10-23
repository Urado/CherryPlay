import type { Zone } from '../../core/types/layout';

const formatSizePercent = (size: number): string => {
  return size.toFixed(2);
};

export const getLayoutStructureSignature = (zone: Zone): string => {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}`;
  }

  return `${zone.direction}(${zone.zones.map(getLayoutStructureSignature).join(',')})`;
};

export const getLayoutStructureDirtySignature = (zone: Zone): string => {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}:${zone.workspaceId}`;
  }

  return `${zone.direction}(${zone.zones.map(getLayoutStructureDirtySignature).join(',')})`;
};

export const getLayoutZoneSignature = (zone: Zone): string => {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}:${zone.workspaceId}`;
  }

  const sizesPart = zone.sizes.map(formatSizePercent).join(',');
  return `${zone.direction}[${sizesPart}](${zone.zones.map(getLayoutZoneSignature).join(',')})`;
};
