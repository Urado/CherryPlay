import {
  Button,
  DEFAULT_PARTY_THEME_ID,
  convertUtcToLocalDateTime,
  convertLocalDateTimeToUtc,
  getDefaultTimeZone,
  getPopularTimeZones,
} from '@cherryplay/components';
import { useState, useRef, useEffect } from 'react';

import { ThemeLockedTile } from '../components/ThemeLockedTile';
import {
  MAX_SHORT_DESCRIPTION_LENGTH,
  MAX_DANCE_TAGS,
  MAX_DANCE_TAG_LENGTH,
  MAX_EXTERNAL_LINK_URL_LENGTH,
  MAX_EXTERNAL_LINK_TEXT_LENGTH,
  PREDEFINED_DANCE_TAGS,
} from '../constants/partyCard';
import { canToggleCatalogVisibility } from '../constants/partyLifecycle';
import { PARTY_THEME_OPTIONS } from '../constants/partyThemes';
import type { CreatePartyDto, PartyDto, ThemeAccessDto, UpdatePartyDto } from '../types/api';

export interface CabinetPartyFormProps {
  editingParty: PartyDto | null;
  editForm: UpdatePartyDto;
  createForm: CreatePartyDto;
  setEditForm: React.Dispatch<React.SetStateAction<UpdatePartyDto>>;
  setCreateForm: React.Dispatch<React.SetStateAction<CreatePartyDto>>;
  savingEdit: boolean;
  creating: boolean;
  themeAccess: ThemeAccessDto | null;
  themeAccessError: string | null;
  onSelectLockedTheme: (themeId: string) => void;
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
  themeAccess,
  themeAccessError,
  onSelectLockedTheme,
  onSubmit,
  onCancel,
}: CabinetPartyFormProps) {
  const isEditing = !!editingParty;
  const grantedThemes = new Set(themeAccess?.grantedThemeIds ?? []);
  const lockedByThemeId = new Map(
    (themeAccess?.visibleLockedThemes ?? []).map((item) => [item.themeId, item]),
  );
  const selectedThemeId = isEditing
    ? (editForm.partyThemeId ?? DEFAULT_PARTY_THEME_ID)
    : createForm.partyThemeId;
  const selectableThemeOptions = PARTY_THEME_OPTIONS.filter((option) => {
    if (grantedThemes.has(option.value)) return true;
    if (lockedByThemeId.has(option.value)) return true;
    return option.value === selectedThemeId;
  });

  const [customTagInput, setCustomTagInput] = useState('');
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const customBlockRef = useRef<HTMLDivElement>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    },
    [],
  );

  const danceTags = isEditing ? (editForm.danceTags ?? []) : (createForm.danceTags ?? []);

  const setDanceTags = (tags: string[]) => {
    const next = tags.length > 0 ? tags : [];
    if (isEditing) {
      setEditForm((f) => ({ ...f, danceTags: next }));
    } else {
      setCreateForm((f) => ({ ...f, danceTags: next }));
    }
  };

  const addDanceTag = (tag: string) => {
    const trimmed = tag.trim().slice(0, MAX_DANCE_TAG_LENGTH);
    if (!trimmed || danceTags.includes(trimmed) || danceTags.length >= MAX_DANCE_TAGS) return;
    setDanceTags([...danceTags, trimmed]);
  };

  const removeDanceTag = (index: number) => {
    setDanceTags(danceTags.filter((_, i) => i !== index));
  };

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

  const showCatalogCheckbox =
    !isEditing ||
    (editingParty != null && canToggleCatalogVisibility(editingParty.partyLifecycleState));

  return (
    <form className="cabinet-form" onSubmit={onSubmit}>
      <h4>{isEditing ? 'Редактировать вечеринку' : 'Новая вечеринка'}</h4>
      {!isEditing && (
        <p className="cabinet-form-hint">
          После создания вечеринка будет в статусе «Ждёт начала». Показ в каталоге — по желанию,
          отдельно от статуса.
        </p>
      )}
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
          value={selectedThemeId}
          onChange={(e) => {
            const nextThemeId = e.target.value;
            if (lockedByThemeId.has(nextThemeId)) {
              onSelectLockedTheme(nextThemeId);
              return;
            }
            if (isEditing) {
              setEditForm((f) => ({ ...f, partyThemeId: nextThemeId }));
            } else {
              setCreateForm((f) => ({ ...f, partyThemeId: nextThemeId }));
            }
          }}
        >
          {selectableThemeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {lockedByThemeId.has(opt.value) ? `🔒 ${opt.label}` : opt.label}
            </option>
          ))}
        </select>
      </label>
      {themeAccessError && <div className="cabinet-error">{themeAccessError}</div>}
      {!!themeAccess?.visibleLockedThemes.length && (
        <div className="cabinet-theme-locked-list">
          {themeAccess.visibleLockedThemes
            .map((item) => ({
              item,
              option: PARTY_THEME_OPTIONS.find((opt) => opt.value === item.themeId),
            }))
            .filter((entry) => !!entry.option)
            .map((entry) => (
              <ThemeLockedTile
                key={entry.item.themeId}
                themeName={entry.option?.label ?? entry.item.themeId}
                lockedTheme={entry.item}
                contactUrl={themeAccess.contactUrl}
              />
            ))}
        </div>
      )}
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
      <label>
        Краткое описание (для карточки)
        <textarea
          value={
            isEditing ? (editForm.shortDescription ?? '') : (createForm.shortDescription ?? '')
          }
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({
                  ...f,
                  shortDescription: e.target.value.slice(0, MAX_SHORT_DESCRIPTION_LENGTH),
                }))
              : setCreateForm((f) => ({
                  ...f,
                  shortDescription: e.target.value.slice(0, MAX_SHORT_DESCRIPTION_LENGTH),
                }))
          }
          rows={2}
          maxLength={MAX_SHORT_DESCRIPTION_LENGTH}
          placeholder="Краткое описание для карточки в каталоге"
        />
        <span className="cabinet-char-count">
          {
            (isEditing ? (editForm.shortDescription ?? '') : (createForm.shortDescription ?? ''))
              .length
          }
          /{MAX_SHORT_DESCRIPTION_LENGTH}
        </span>
      </label>
      <label>
        Ссылка (URL)
        <input
          type="url"
          value={isEditing ? (editForm.externalLinkUrl ?? '') : (createForm.externalLinkUrl ?? '')}
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({
                  ...f,
                  externalLinkUrl: e.target.value.slice(0, MAX_EXTERNAL_LINK_URL_LENGTH),
                }))
              : setCreateForm((f) => ({
                  ...f,
                  externalLinkUrl: e.target.value.slice(0, MAX_EXTERNAL_LINK_URL_LENGTH),
                }))
          }
          placeholder="https://..."
          maxLength={MAX_EXTERNAL_LINK_URL_LENGTH}
        />
      </label>
      <label>
        Текст ссылки
        <input
          type="text"
          value={
            isEditing ? (editForm.externalLinkText ?? '') : (createForm.externalLinkText ?? '')
          }
          onChange={(e) =>
            isEditing
              ? setEditForm((f) => ({
                  ...f,
                  externalLinkText: e.target.value.slice(0, MAX_EXTERNAL_LINK_TEXT_LENGTH),
                }))
              : setCreateForm((f) => ({
                  ...f,
                  externalLinkText: e.target.value.slice(0, MAX_EXTERNAL_LINK_TEXT_LENGTH),
                }))
          }
          placeholder="Текст ссылки (если пусто — «Ссылка»)"
          maxLength={MAX_EXTERNAL_LINK_TEXT_LENGTH}
        />
      </label>
      <div className="cabinet-form-field">
        <span className="cabinet-form-field-label">Танцевальные теги (макс. {MAX_DANCE_TAGS})</span>
        <div className="cabinet-dance-tags-predefined">
          {PREDEFINED_DANCE_TAGS.map((option) => (
            <Button
              key={option}
              type="button"
              variant="ghost"
              size="sm"
              className={`cabinet-tag-btn ${danceTags.includes(option) ? 'cabinet-tag-btn--selected' : ''}`}
              onClick={() => {
                if (danceTags.includes(option)) {
                  removeDanceTag(danceTags.indexOf(option));
                } else if (danceTags.length < MAX_DANCE_TAGS) {
                  addDanceTag(option);
                }
              }}
              disabled={!danceTags.includes(option) && danceTags.length >= MAX_DANCE_TAGS}
            >
              {option}
            </Button>
          ))}
          {!showCustomTagInput ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cabinet-tag-btn"
              onClick={() => {
                if (collapseTimeoutRef.current) {
                  clearTimeout(collapseTimeoutRef.current);
                  collapseTimeoutRef.current = null;
                }
                setShowCustomTagInput(true);
              }}
              disabled={danceTags.length >= MAX_DANCE_TAGS}
              aria-label="Ввести другой танец"
            >
              Другой танец
            </Button>
          ) : (
            <div
              ref={customBlockRef}
              className="cabinet-dance-tags-custom cabinet-dance-tags-custom--inline"
            >
              <input
                type="text"
                className="cabinet-tag-input"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value.slice(0, MAX_DANCE_TAG_LENGTH))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addDanceTag(customTagInput);
                    setCustomTagInput('');
                    if (collapseTimeoutRef.current) {
                      clearTimeout(collapseTimeoutRef.current);
                      collapseTimeoutRef.current = null;
                    }
                    setShowCustomTagInput(false);
                  }
                }}
                onBlur={(e) => {
                  if (e.relatedTarget && customBlockRef.current?.contains(e.relatedTarget as Node))
                    return;
                  collapseTimeoutRef.current = setTimeout(() => setShowCustomTagInput(false), 150);
                }}
                placeholder="Другой танец (Enter или запятая)"
                maxLength={MAX_DANCE_TAG_LENGTH}
                disabled={danceTags.length >= MAX_DANCE_TAGS}
                aria-label="Поле для ввода другого танца"
                autoFocus
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  addDanceTag(customTagInput);
                  setCustomTagInput('');
                  if (collapseTimeoutRef.current) {
                    clearTimeout(collapseTimeoutRef.current);
                    collapseTimeoutRef.current = null;
                  }
                  setShowCustomTagInput(false);
                }}
                disabled={danceTags.length >= MAX_DANCE_TAGS || !customTagInput.trim()}
              >
                Добавить
              </Button>
            </div>
          )}
        </div>
        {danceTags.length > 0 && (
          <div className="cabinet-dance-tags-list">
            {danceTags.map((tag, index) => (
              <span key={`${tag}-${index}`} className="cabinet-tag-chip">
                {tag}
                <button
                  type="button"
                  className="cabinet-tag-remove"
                  onClick={() => removeDanceTag(index)}
                  aria-label={`Удалить тег ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {showCatalogCheckbox && (
        <label
          className="cabinet-checkbox"
          title="Отдельно от статуса вечеринки: общий каталог или только по ссылке"
        >
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
      )}
      <div className="cabinet-form-actions">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Отмена
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={isEditing ? savingEdit : creating}
        >
          {isEditing ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
}
