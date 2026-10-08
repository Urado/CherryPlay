export const canDiscardUnsavedProjectChanges = (
  isDirty: boolean,
  confirmDiscard: () => boolean,
): boolean => {
  return !isDirty || confirmDiscard();
};
