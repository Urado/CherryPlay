import {
  HEADER_PARTY_STATUS_UNREACHABLE_LABEL,
  resolveHeaderPartyStatusTooltip,
} from '../../src/app/components/headerPartyStatusVisuals';

describe('resolveHeaderPartyStatusTooltip', () => {
  it('maps each lifecycle primary label to Russian title', () => {
    expect(resolveHeaderPartyStatusTooltip('Локально')).toBe(
      'Проект ещё не привязан к вечеринке на сервере',
    );
    expect(resolveHeaderPartyStatusTooltip('Черновик')).toBe('Вечеринка на сервере в черновике');
    expect(resolveHeaderPartyStatusTooltip('Не начато')).toBe(
      'Опубликована на сайте, ожидает начала',
    );
    expect(resolveHeaderPartyStatusTooltip('Идёт')).toBe('Идёт локальная сессия проигрывания');
    expect(resolveHeaderPartyStatusTooltip('Архив')).toBe('Вечеринка в архиве');
  });

  it('maps нет связи secondary overlay', () => {
    expect(resolveHeaderPartyStatusTooltip(HEADER_PARTY_STATUS_UNREACHABLE_LABEL)).toBe(
      'Нет связи с сервером',
    );
  });

  it('returns null for unknown labels', () => {
    expect(resolveHeaderPartyStatusTooltip('')).toBeNull();
    expect(resolveHeaderPartyStatusTooltip('unknown')).toBeNull();
  });
});
