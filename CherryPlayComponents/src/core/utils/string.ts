export const stripLastExtension = (name: string): string => {
  if (typeof name !== 'string' || name.length === 0) return name;
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
};
