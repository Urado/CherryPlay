import { getWorkspaceDisplayNameRu } from '@core/constants/workspaceDisplayNames';
import { workspaceRegistry } from '@core/registry';
import { Layout } from '@core/types/layout';
import {
  collectWorkspaceTypes,
  isSingletonWorkspaceType,
} from '@shared/utils/layoutWorkspaceOperations';

export interface WorkspacePickerOption {
  type: string;
  name: string;
}

function isWorkspaceTypeUsedInLayout(type: string, usedTypes: Set<string>): boolean {
  if (type === 'player' || type === 'aimp') {
    return usedTypes.has('player') || usedTypes.has('aimp');
  }

  return usedTypes.has(type);
}

export function getWorkspacePickerOptions(layout?: Layout): WorkspacePickerOption[] {
  const usedTypes = layout ? collectWorkspaceTypes(layout.rootZone) : new Set<string>();

  const options = workspaceRegistry
    .getAllModulesByType()
    .filter((module) => module.type !== 'aimp')
    .map((module) => ({
      type: module.type,
      name: getWorkspaceDisplayNameRu(module.type, module.name),
    }));

  if (!options.some((option) => option.type === 'fileBrowser')) {
    options.push({
      type: 'fileBrowser',
      name: getWorkspaceDisplayNameRu('fileBrowser'),
    });
  }

  return options
    .filter(
      (option) =>
        !isSingletonWorkspaceType(option.type) ||
        !isWorkspaceTypeUsedInLayout(option.type, usedTypes),
    )
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}
