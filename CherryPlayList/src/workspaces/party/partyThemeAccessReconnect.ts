import type { ThemeAccessLoadResult } from './partyThemeAccessLoad';

export type { ThemeAccessLoadResult };

export function resolveUnlinkedThemeAccessReconnectAction(input: {
  result: ThemeAccessLoadResult;
  hasLinkedParty: boolean;
}): 'start' | 'clear' | 'none' {
  if (input.hasLinkedParty) {
    return 'none';
  }
  if (input.result === 'unreachable') {
    return 'start';
  }
  if (input.result === 'ok') {
    return 'clear';
  }
  return 'none';
}
