import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const readTextFile = (path: URL): string => readFileSync(path, 'utf8');
const readThemeStyles = (theme: string): string =>
  readTextFile(new URL(`./${theme}/playlist-item.css`, import.meta.url));
const sharedPlaylistStyles = readTextFile(
  new URL('../components/Playlist/PlaylistItem.css', import.meta.url),
);

const stylesByTheme: Record<string, string> = {
  'art-deco': readThemeStyles('art-deco'),
  cyberpunk: readThemeStyles('cyberpunk'),
  basic: readThemeStyles('basic'),
  'spring-cross-step': readThemeStyles('spring-cross-step'),
};

const getRule = (styles: string, selector: string): string | undefined => {
  const selectorIndex = styles.indexOf(selector);
  if (selectorIndex < 0) return undefined;
  const openBrace = styles.indexOf('{', selectorIndex);
  const closeBrace = styles.indexOf('}', openBrace);
  if (openBrace < 0 || closeBrace < 0) return undefined;
  return styles.slice(openBrace + 1, closeBrace);
};

describe('disabled playlist marker theme styles', () => {
  it.each(Object.entries(stylesByTheme))(
    '%s dims row content without dimming the marker',
    (theme, styles) => {
      const parentRule = getRule(
        styles,
        `[data-theme='${theme}'] .party-playlist-item--disabled`,
      );
      const contentRule = getRule(
        styles,
        `[data-theme='${theme}'] .party-playlist-item--disabled .party-playlist-item-content`,
      );

      expect(parentRule).toBeDefined();
      expect(parentRule).toMatch(/opacity:\s*1\s*;/);
      if (theme === 'basic' || theme === 'spring-cross-step') {
        const infoRule = getRule(
          styles,
          `[data-theme='${theme}'] .party-playlist-item--disabled .party-playlist-item-info`,
        );
        const durationRule = getRule(
          styles,
          `[data-theme='${theme}'] .party-playlist-item--disabled .party-playlist-item-duration`,
        );
        expect(infoRule).toContain('opacity: 0.85;');
        expect(durationRule).toContain('opacity: 0.85;');
      } else {
        expect(contentRule).toContain('opacity: 0.35;');
      }
      if (theme === 'spring-cross-step') {
        const markerRule = getRule(
          styles,
          `[data-theme='${theme}'] .party-playlist-item-circle[data-state='disabled']`,
        );
        expect(markerRule).toContain('background: var(--canceled-track);');
        expect(markerRule).toContain('color: var(--flower-white);');
      } else if (theme === 'art-deco') {
        const markerRule = getRule(
          styles,
          `[data-theme='${theme}'] .party-playlist-item-circle[data-state='disabled']`,
        );
        expect(markerRule).toContain('background: #dc2626;');
        expect(markerRule).toContain('color: #fff;');
      } else {
        expect(sharedPlaylistStyles).toContain(
          '.party-playlist-item--disabled .party-playlist-item-circle[data-state=\'disabled\']',
        );
        expect(sharedPlaylistStyles).toContain('background: #dc2626;');
      }
    },
  );
});
