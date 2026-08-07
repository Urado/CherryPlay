import { describe, expect, it } from 'vitest';

import { LIFECYCLE_STATUS_LABELS } from '../constants/partyLifecycle';

import { InvalidPartyLifecycleTransitionError, ThemeNotEntitledError } from './partyApiErrors';

describe('InvalidPartyLifecycleTransitionError', () => {
  it('exposes code, name, and lifecycle states', () => {
    const currentState = 'ready' as const;
    const requestedState = 'draft' as const;
    const message = `Нельзя перевести вечеринку из «${LIFECYCLE_STATUS_LABELS[currentState]}» в «${LIFECYCLE_STATUS_LABELS[requestedState]}».`;
    const error = new InvalidPartyLifecycleTransitionError(message, currentState, requestedState);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidPartyLifecycleTransitionError');
    expect(error.code).toBe('invalid_lifecycle_transition');
    expect(error.message).toBe('Нельзя перевести вечеринку из «Ждёт начала» в «Черновик».');
    expect(error.currentState).toBe('ready');
    expect(error.requestedState).toBe('draft');
  });
});

describe('ThemeNotEntitledError', () => {
  it('exposes code, themeId, and requiredPackageCodes', () => {
    const error = new ThemeNotEntitledError(
      'Тема недоступна без пакета: premium.',
      'spring-cross-step',
      ['premium'],
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ThemeNotEntitledError');
    expect(error.code).toBe('theme_not_entitled');
    expect(error.themeId).toBe('spring-cross-step');
    expect(error.requiredPackageCodes).toEqual(['premium']);
  });

  it('defaults requiredPackageCodes to an empty array', () => {
    const error = new ThemeNotEntitledError('Тема недоступна.');

    expect(error.themeId).toBeUndefined();
    expect(error.requiredPackageCodes).toEqual([]);
  });
});
