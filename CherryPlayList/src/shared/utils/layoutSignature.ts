import type { Zone } from '../../core/types/layout';

function formatSizePercent(size: number): string {
  return size.toFixed(2);
}

export function getLayoutStructureSignature(zone: Zone): string {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}`;
  }

  return `${zone.direction}(${zone.zones.map(getLayoutStructureSignature).join(',')})`;
}

export function getLayoutStructureDirtySignature(zone: Zone): string {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}:${zone.workspaceId}`;
  }

  return `${zone.direction}(${zone.zones.map(getLayoutStructureDirtySignature).join(',')})`;
}

export function getLayoutZoneSignature(zone: Zone): string {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}:${zone.workspaceId}`;
  }

  const sizesPart = zone.sizes.map(formatSizePercent).join(',');
  return `${zone.direction}[${sizesPart}](${zone.zones.map(getLayoutZoneSignature).join(',')})`;
}
