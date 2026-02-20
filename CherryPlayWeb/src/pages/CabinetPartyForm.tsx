import { THEME_OPTIONS } from '../constants/themes';
import type { CreatePartyDto, PartyDto, UpdatePartyDto } from '../types/api';
import { getDefaultTimeZone, getPopularTimeZones } from '../utils/timezoneUtils';

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

  const datetimeValue = (dt: string | undefined) => {
    if (!dt) return '';
    try {
      return new Date(dt).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const setDatetime = (value: string) => (value ? new Date(value).toISOString() : undefined);

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
        Тема
        <select
          value={isEditing ? (editForm.themeId ?? 'cyberpunk') : createForm.themeId}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, themeId: e.target.value }))
              : setCreateForm((f) => ({ ...f, themeId: e.target.value }))
          }
        >
          {THEME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Дата мероприятия
        <input
          type="datetime-local"
          value={datetimeValue(isEditing ? editForm.eventDateTime : createForm.eventDateTime)}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, eventDateTime: setDatetime(e.target.value) }))
              : setCreateForm((f) => ({ ...f, eventDateTime: setDatetime(e.target.value) }))
          }
        />
      </label>
      <label>
        Таймзона
        <select
          value={
            isEditing
              ? (editForm.timeZone ?? getDefaultTimeZone())
              : (createForm.timeZone ?? getDefaultTimeZone())
          }
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({ ...f, timeZone: e.target.value }))
              : setCreateForm((f) => ({ ...f, timeZone: e.target.value }))
          }
        >
          {getPopularTimeZones().map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
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
