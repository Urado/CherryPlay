import { describe, expect, it } from '@jest/globals';

import {
  createFileBrowserNavState,
  goBackInFileBrowserHistory,
  pushFileBrowserPath,
} from '../../src/shared/utils/fileBrowserNavigationHistory';

describe('fileBrowserNavigationHistory', () => {
  it('createFileBrowserNavState sets a single entry at index 0', () => {
    const s = createFileBrowserNavState('C:/a');
    expect(s.entries).toEqual(['C:/a']);
    expect(s.index).toBe(0);
  });

  it('createFileBrowserNavState trims and normalizes separators', () => {
    const s = createFileBrowserNavState('  C:\\a\\b  ');
    expect(s.entries).toEqual(['C:/a/b']);
  });

  it('createFileBrowserNavState canonicalizes Windows drive root', () => {
    expect(createFileBrowserNavState('D:').entries).toEqual(['D:/']);
    expect(createFileBrowserNavState('E:/').entries).toEqual(['E:/']);
  });

  it('pushFileBrowserPath appends a path and moves index forward', () => {
    const s0 = createFileBrowserNavState('C:/a');
    const s1 = pushFileBrowserPath(s0, 'C:/a/b');
    expect(s1.entries).toEqual(['C:/a', 'C:/a/b']);
    expect(s1.index).toBe(1);
  });

  it('pushFileBrowserPath trims forward history when navigating from a past index', () => {
    const s0 = createFileBrowserNavState('A');
    const s1 = pushFileBrowserPath(s0, 'B');
    const s2 = pushFileBrowserPath(s1, 'C');
    const sBack = goBackInFileBrowserHistory(s2);
    expect(sBack.index).toBe(1);
    expect(sBack.entries).toEqual(['A', 'B', 'C']);

    const sBranch = pushFileBrowserPath(sBack, 'D');
    expect(sBranch.entries).toEqual(['A', 'B', 'D']);
    expect(sBranch.index).toBe(2);
  });

  it('pushFileBrowserPath is a no-op for the current path (same reference)', () => {
    const s0 = createFileBrowserNavState('C:/a');
    const s1 = pushFileBrowserPath(s0, 'C:/a');
    expect(s1).toBe(s0);
  });

  it('pushFileBrowserPath is a no-op when only whitespace or separators differ', () => {
    const s0 = createFileBrowserNavState('C:/a/b');
    expect(pushFileBrowserPath(s0, 'C:\\a\\b')).toBe(s0);
    expect(pushFileBrowserPath(s0, '  C:/a/b  ')).toBe(s0);
  });

  it('goBackInFileBrowserHistory decrements index and keeps entries', () => {
    const s0 = createFileBrowserNavState('A');
    const s1 = pushFileBrowserPath(s0, 'B');
    const sBack = goBackInFileBrowserHistory(s1);
    expect(sBack.index).toBe(0);
    expect(sBack.entries).toEqual(['A', 'B']);
  });

  it('goBackInFileBrowserHistory is a no-op at index 0', () => {
    const s0 = createFileBrowserNavState('A');
    const sBack = goBackInFileBrowserHistory(s0);
    expect(sBack).toBe(s0);
  });
});
