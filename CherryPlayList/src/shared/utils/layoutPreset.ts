import type { LayoutPreset } from '@core/types/workspacePreset';

import type { Layout } from '../../core/types/layout';

import { getLayoutStructureSignature } from './layoutSignature';

const LAYOUT_PRESET_SIGNATURES: Record<LayoutPreset, string> = {
  simple: 'horizontal(workspace:playlist,workspace:fileBrowser)',
  complex:
    'horizontal(workspace:playlist,workspace:test7,vertical(horizontal(workspace:test1,workspace:test2,workspace:test5),horizontal(workspace:test3,workspace:test4,workspace:test6),horizontal(workspace:test8)))',
  collections:
    'horizontal(workspace:playlist,vertical(horizontal(workspace:collection,workspace:collection),workspace:fileBrowser))',
  'collections-vertical':
    'horizontal(workspace:playlist,vertical(workspace:collection,workspace:collection),workspace:fileBrowser)',
  player: 'horizontal(workspace:player,workspace:fileBrowser)',
  party: 'horizontal(workspace:player,workspace:party-preview)',
};

export function getLayoutPresetFromLayout(layout: Layout): LayoutPreset | null {
  const signature = getLayoutStructureSignature(layout.rootZone);

  for (const [preset, expectedSignature] of Object.entries(LAYOUT_PRESET_SIGNATURES) as Array<
    [LayoutPreset, string]
  >) {
    if (signature === expectedSignature) {
      return preset;
    }
  }

  return null;
}
