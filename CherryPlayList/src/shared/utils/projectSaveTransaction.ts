export const runProjectSaveTransaction = async (
  save: () => Promise<unknown>,
  commit: () => void,
): Promise<void> => {
  await save();
  commit();
};
