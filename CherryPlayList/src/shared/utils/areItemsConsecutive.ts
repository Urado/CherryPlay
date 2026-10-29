import { isProjectGroup, ProjectItem } from '@core/types/project';

export const areItemsConsecutive = (
  itemIds: string[],
  items: ProjectItem[],
  getItemPath: (id: string) => string[],
  findItemById: (id: string) => ProjectItem | null,
): boolean => {
  if (itemIds.length < 2) return false;

  const itemPaths = itemIds.map((id) => ({ id, path: getItemPath(id) || [] }));
  const firstPath = itemPaths[0].path;
  const parentId = firstPath.length > 1 ? firstPath[firstPath.length - 2] : null;

  for (let i = 1; i < itemPaths.length; i++) {
    const currentPath = itemPaths[i].path;
    const currentParentId = currentPath.length > 1 ? currentPath[currentPath.length - 2] : null;
    if (currentParentId !== parentId) return false;
  }

  const parentContainer =
    parentId === null
      ? items
      : (() => {
          const parentGroup = findItemById(parentId);
          return parentGroup && isProjectGroup(parentGroup) ? parentGroup.items : null;
        })();

  if (!parentContainer) return false;

  const itemIndices = itemIds.map((itemId) =>
    parentContainer.findIndex((item) => item.id === itemId),
  );
  if (itemIndices.some((index) => index === -1)) return false;

  const sortedIndices = [...itemIndices].sort((a, b) => a - b);
  return sortedIndices.every((index, position) => position === 0 || index === sortedIndices[position - 1] + 1);
};
