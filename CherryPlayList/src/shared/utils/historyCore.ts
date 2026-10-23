import { ProjectItem } from '@core/types/project';

export const cloneItem = (item: ProjectItem): ProjectItem => {
  if ('items' in item) {
    return {
      id: item.id,
      name: item.name,
      items: item.items.map(cloneItem),
    };
  }
  return { ...item };
};

export const cloneItems = (items: ProjectItem[]): ProjectItem[] => {
  return items.map(cloneItem);
};

export const cloneProjectItem = cloneItem;

export const cloneProjectItems = cloneItems;
