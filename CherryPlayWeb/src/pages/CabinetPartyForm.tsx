import {
  convertUtcToLocalDateTime,
  convertLocalDateTimeToUtc,
  getDefaultTimeZone,
  getPopularTimeZones,
} from '@cherryplay/components';

import { PARTY_THEME_OPTIONS } from '../constants/partyThemes';
import type { CreatePartyDto, PartyDto, UpdatePartyDto } from '../types/api';

export interface CabinetPartyFormProps {
  editingParty: PartyDto | null;
  editForm: UpdatePartyDto;
  createForm: CreatePartyDto;
  setEditForm: React.Dispatch<React.SetStateAction<UpdatePartyDto>>;
  setCreateForm: React.Dispatch<React.SetStateAction<CreatePartyDto>>;
  savingEdit: boolean;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function CabinetPartyForm({
  editingParty,
  editForm,
  createForm,
  setEditForm,
  setCreateForm,
  savingEdit,
  creating,
  onSubmit,
  onCancel,
}: CabinetPartyFormProps) {
  const isEditing = !!editingParty;

  const timeZone = isEditing
    ? (editForm.timeZone ?? getDefaultTimeZone())
    : (createForm.timeZone ?? getDefaultTimeZone());

  const displayedDateTime = isEditing
    ? convertUtcToLocalDateTime(editForm.eventDateTime ?? '', timeZone)
    : convertUtcToLocalDateTime(createForm.eventDateTime ?? '', timeZone);

  const handleDateTimeChange = (value: string) => {
    const raw = value ? convertLocalDateTimeToUtc(value, timeZone) : undefined;
    const utc = raw === '' ? undefined : raw;
    if (isEditing) {
      setEditForm((f) => ({ ...f, eventDateTime: utc }));
    } else {
      setCreateForm((f) => ({ ...f, eventDateTime: utc }));
    }
  };

  return (
    <form className="cabinet-form" onSubmit={onSubmit}>
      <h4>{isEditing ? 'Редактировать вечеринку' : 'Новая вечеринка'}</h4>
      <label>
        Название *
        <input
          type="text"
          value={isEditing ? (editForm.name ?? '') : createForm.name}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, name: e.target.value }))
              : setCreateForm((f) => ({ ...f, name: e.target.value }))
          }
          required
          maxLength={200}
        />
      </label>
      <label>
        Заголовок (на экране)
        <input
          type="text"
          value={isEditing ? (editForm.title ?? '') : (createForm.title ?? '')}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, title: e.target.value }))
              : setCreateForm((f) => ({ ...f, title: e.target.value }))
          }
          placeholder="Если пусто — показывается название"
          maxLength={500}
        />
      </label>
      <label>
        Подзаголовок
        <input
          type="text"
          value={isEditing ? (editForm.subtitle ?? '') : (createForm.subtitle ?? '')}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, subtitle: e.target.value }))
              : setCreateForm((f) => ({ ...f, subtitle: e.target.value }))
          }
          placeholder="Строка под заголовком"
          maxLength={500}
        />
      </label>
      <label>
        Тема
        <select
          value={isEditing ? (editForm.partyThemeId ?? 'cyberpunk') : createForm.partyThemeId}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, partyThemeId: e.target.value }))
              : setCreateForm((f) => ({ ...f, partyThemeId: e.target.value }))
          }
        >
          {PARTY_THEME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Таймзона
        <select
          value={
            isEditing
              ? (editForm.timeZone ?? getDefaultTimeZone())
              : (createForm.timeZone ?? getDefaultTimeZone())
          }
          onChange={(e) => {
            const newTz = e.target.value;
            if (isEditing) {
              setEditForm((f) => {
                const currentDisplay = convertUtcToLocalDateTime(
                  f.eventDateTime ?? '',
                  f.timeZone ?? getDefaultTimeZone(),
                );
                const newUtc = currentDisplay
                  ? convertLocalDateTimeToUtc(currentDisplay, newTz)
                  : undefined;
                return { ...f, timeZone: newTz, eventDateTime: newUtc ?? undefined };
              });
            } else {
              setCreateForm((f) => {
                const currentDisplay = convertUtcToLocalDateTime(
                  f.eventDateTime ?? '',
                  f.timeZone ?? getDefaultTimeZone(),
                );
                const newUtc = currentDisplay
                  ? convertLocalDateTimeToUtc(currentDisplay, newTz)
                  : undefined;
                return { ...f, timeZone: newTz, eventDateTime: newUtc ?? undefined };
              });
            }
          }}
        >
          {getPopularTimeZones().map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Дата мероприятия (по местному времени выбранной таймзоны)
        <input
          type="datetime-local"
          value={displayedDateTime}
          onChange={(e) => handleDateTimeChange(e.target.value)}
        />
      </label>
      <label>
        Описание
        <textarea
          value={isEditing ? (editForm.description ?? '') : (createForm.description ?? '')}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, description: e.target.value }))
              : setCreateForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={3}
        />
      </label>
      <label>
        Место
        <input
          type="text"
          value={isEditing ? (editForm.place ?? '') : (createForm.place ?? '')}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, place: e.target.value }))
              : setCreateForm((f) => ({ ...f, place: e.target.value }))
          }
        />
      </label>
      <label>
        Город
        <input
          type="text"
          value={isEditing ? (editForm.city ?? '') : (createForm.city ?? '')}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, city: e.target.value }))
              : setCreateForm((f) => ({ ...f, city: e.target.value }))
          }
        />
      </label>
      <label className="cabinet-checkbox">
        <input
          type="checkbox"
          checked={
            isEditing
              ? (editForm.isListedInCatalog ?? false)
              : (createForm.isListedInCatalog ?? false)
          }
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, isListedInCatalog: e.target.checked }))
              : setCreateForm((f) => ({ ...f, isListedInCatalog: e.target.checked }))
          }
        />
        Показывать в каталоге
      </label>
      <div className="cabinet-form-actions">
        <button type="button" className="cabinet-btn" onClick={onCancel}>
          Отмена
        </button>
        <button
          type="submit"
          className="cabinet-btn cabinet-btn-primary"
          disabled={isEditing ? savingEdit : creating}
        >
          {isEditing
            ? savingEdit
              ? 'Сохранение…'
              : 'Сохранить'
            : creating
              ? 'Создание…'
              : 'Создать'}
        </button>
      </div>
    </form>
  );
}
