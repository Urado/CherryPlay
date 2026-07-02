import type { Zone } from '../../core/types/layout';

export function getLayoutZoneSignature(zone: Zone): string {
  if (zone.type === 'workspace') {
    return `workspace:${zone.workspaceType}`;
  }

  return `${zone.direction}(${zone.zones.map(getLayoutZoneSignature).join(',')})`;
}
