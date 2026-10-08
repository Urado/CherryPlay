const parseHex = (value: string): [number, number, number] | null => {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(normalized)) return null;
  const expanded = normalized.length === 3 ? normalized.split('').map((char) => char + char).join('') : normalized;
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16)) as [number, number, number];
};

const channelLuminance = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = ([red, green, blue]: [number, number, number]) =>
  0.2126 * channelLuminance(red) + 0.7152 * channelLuminance(green) + 0.0722 * channelLuminance(blue);

const toHex = ([red, green, blue]: [number, number, number]) =>
  `#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

const ratio = (first: number, second: number) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

export const ensureQrContrast = (foreground: string, background: string) => {
  const parsedBackground = parseHex(background) ?? [255, 255, 255];
  const parsedForeground = parseHex(foreground) ?? [0, 0, 0];
  const backgroundLuminance = luminance(parsedBackground);
  const targetLuminance = backgroundLuminance > 0.5 ? 0 : 1;

  if (ratio(backgroundLuminance, targetLuminance) < 7) {
    return { foreground: '#000000', background: '#ffffff' };
  }

  if (ratio(backgroundLuminance, luminance(parsedForeground)) >= 7) {
    return { foreground: toHex(parsedForeground), background: toHex(parsedBackground) };
  }

  for (let step = 1; step <= 100; step += 1) {
    const amount = step / 100;
    const adjusted = parsedForeground.map((channel) => channel + (targetLuminance * 255 - channel) * amount) as [number, number, number];
    if (ratio(backgroundLuminance, luminance(adjusted)) >= 7) {
      return { foreground: toHex(adjusted), background: toHex(parsedBackground) };
    }
  }

  return {
    foreground: backgroundLuminance > 0.5 ? '#000000' : '#ffffff',
    background: toHex(parsedBackground),
  };
};
