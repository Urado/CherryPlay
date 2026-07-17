export function formatGainDb(gainDb: number): string {
  const rounded = gainDb.toFixed(1);
  return gainDb > 0 ? `+${rounded}` : rounded;
}
