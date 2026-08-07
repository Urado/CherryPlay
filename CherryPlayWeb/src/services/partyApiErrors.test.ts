import { describe, expect, it } from 'vitest';

import { InvalidPartyLifecycleTransitionError, ThemeNotEntitledError } from './partyApiErrors';

describe('InvalidPartyLifecycleTransitionError', () => {
  it('exposes code, name, and lifecycle states', () => {
    const error = new InvalidPartyLifecycleTransitionError(
      'Нельзя перевести вечеринку из «Завершена» в «Ждёт начала».',
      'completed',
      'ready',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidPartyLifecycleTransitionError');
    expect(error.code).toBe('invalid_lifecycle_transition');
    expect(error.message).toBe('Нельзя перевести вечеринку из «Завершена» в «Ждёт начала».');
    expect(error.currentState).toBe('completed');
    expect(error.requestedState).toBe('ready');
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
