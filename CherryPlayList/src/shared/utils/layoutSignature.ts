import type { Zone } from '../../core/types/layout';

function formatSizePercent(size: number): string {
  return size.toFixed(2);
}

/** Structure-only signature (preset matching, legacy migration). */
export function getLayoutStructureSignature(zone: Zone): string {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}`;
  }

  return `${zone.direction}(${zone.zones.map(getLayoutStructureSignature).join(',')})`;
}

/** Full signature including container sizes (dirty detection, resize tracking). */
export function getLayoutZoneSignature(zone: Zone): string {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}:${zone.workspaceId}`;
  }

  const sizesPart = zone.sizes.map(formatSizePercent).join(',');
  return `${zone.direction}[${sizesPart}](${zone.zones.map(getLayoutZoneSignature).join(',')})`;
}
