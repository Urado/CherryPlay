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

export const AIR_DISABLED_HINT = 'Недостаточно места — увеличьте окно или измените пропорции';

export const LAYOUT_EDIT_DISABLED_TITLE = 'Недоступно в режиме редактирования окон';

function isWorkspaceTypeUsedInLayout(type: string, usedTypes: Set<string>): boolean {
  if (type === 'player' || type === 'aimp') {
    return usedTypes.has('player') || usedTypes.has('aimp');
  }

  return usedTypes.has(type);
}

function isTestWorkspaceType(type: string): boolean {
  return /^test\d$/.test(type);
}

export function getWorkspacePickerOptions(layout?: Layout): WorkspacePickerOption[] {
  const usedTypes = layout ? collectWorkspaceTypes(layout.rootZone) : new Set<string>();

  const options = workspaceRegistry
    .getAllModulesByType()
    .filter((module) => module.type !== 'aimp' && !isTestWorkspaceType(module.type))
    .map((module) => ({
      type: module.type,
      name: getWorkspaceDisplayNameRu(module.type, module.name),
    }));

  return options
    .filter(
      (option) =>
        !isSingletonWorkspaceType(option.type) ||
        !isWorkspaceTypeUsedInLayout(option.type, usedTypes),
    )
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}
