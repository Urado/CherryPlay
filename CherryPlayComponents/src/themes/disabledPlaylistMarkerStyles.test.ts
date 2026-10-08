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
    '%s styles disabled tracks for the theme',
    (theme, styles) => {
      const parentRule = getRule(
        styles,
        `[data-theme='${theme}'] .party-playlist-item--disabled`,
      );

      expect(parentRule).toBeDefined();

      if (theme === 'basic') {
        expect(parentRule).toMatch(/opacity:\s*0\.65\s*;/);
        expect(parentRule).toContain('text-decoration: line-through;');
        const markerRule = getRule(
          styles,
          `[data-theme='${theme}'] .party-playlist-item-circle[data-state='disabled']`,
        );
        expect(markerRule).toContain('background: var(--border-color, #e0e0e0);');
        expect(markerRule).toContain('color: var(--text-secondary, #666666);');
        return;
      }

      expect(parentRule).toMatch(/opacity:\s*1\s*;/);
      if (theme === 'spring-cross-step') {
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
        const contentRule = getRule(
          styles,
          `[data-theme='${theme}'] .party-playlist-item--disabled .party-playlist-item-content`,
        );
        expect(contentRule).toContain('opacity: 0.35;');
      }
      if (theme === 'spring-cross-step' || theme === 'art-deco') {
        const markerRule = getRule(
          styles,
          `[data-theme='${theme}'] .party-playlist-item-circle[data-state='disabled']`,
        );
        expect(markerRule).toContain('background: var(--canceled-track);');
        expect(markerRule).toContain('color: var(--canceled-track-icon);');
      } else {
        expect(sharedPlaylistStyles).toContain(
          ".party-playlist-item--disabled .party-playlist-item-circle[data-state='disabled']",
        );
        expect(sharedPlaylistStyles).toContain('background: var(--canceled-track);');
        expect(sharedPlaylistStyles).toContain('color: var(--canceled-track-icon);');
      }
    },
  );
});
