import { describe, expect, it } from 'vitest';

import { resolveGroupDisplayDepth } from './PartyDisplay';

describe('resolveGroupDisplayDepth', () => {
  it.each([
    [{ groupDisplayDepth: 0 }, 0],
    [{ groupDisplayDepth: 10 }, 10],
    [{ groupDisplayDepth: -1 }, 3],
    [{ groupDisplayDepth: 1.5 }, 3],
    [{ groupDisplayDepth: 11 }, 3],
    [{ groupDisplayDepth: '7' }, 3],
    [{}, 3],
    [undefined, 3],
  ])('resolves %o to depth %i', (settings, expected) => {
    expect(resolveGroupDisplayDepth(settings)).toBe(expected);
  });
});
