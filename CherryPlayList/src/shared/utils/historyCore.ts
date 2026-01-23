import { ProjectItem } from '@core/types/project';

export function cloneItem(item: ProjectItem): ProjectItem {
  if ('items' in item) {
    return {
      id: item.id,
      name: item.name,
      items: item.items.map(cloneItem),
    };
  }
  return { ...item };
}

export function cloneItems(items: ProjectItem[]): ProjectItem[] {
  return items.map(cloneItem);
}

/** @deprecated Use cloneItem instead */
export const cloneProjectItem = cloneItem;

/** @deprecated Use cloneItems instead */
export const cloneProjectItems = cloneItems;
