import {
  HEADER_PARTY_STATUS_UNREACHABLE_LABEL,
  resolveHeaderPartyStatusTooltip,
} from '../../src/app/components/headerPartyStatusVisuals';

describe('resolveHeaderPartyStatusTooltip', () => {
  it('maps each lifecycle primary label to Russian title', () => {
    expect(resolveHeaderPartyStatusTooltip('Не создана')).toBe(
      'Вечеринка на сервере ещё не создана — только этот проект',
    );
    expect(resolveHeaderPartyStatusTooltip('Черновик')).toBe(
      'Есть на сервере, ещё готовится. Это не «скрыта из каталога» — каталог настраивается отдельно («По ссылке» / «В каталоге»)',
    );
    expect(resolveHeaderPartyStatusTooltip('Ждёт начала')).toBe(
      'Опубликована для гостей, проигрывание ещё не запущено',
    );
    expect(resolveHeaderPartyStatusTooltip('Идёт')).toBe(
      'Сейчас идёт проигрывание; гости видят актуальное состояние',
    );
    expect(resolveHeaderPartyStatusTooltip('Завершена')).toBe('Вечеринка завершена');
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
