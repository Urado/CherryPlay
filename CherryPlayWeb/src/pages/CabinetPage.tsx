import type { OrganizerDto } from '@cherryplay/components';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authService } from '../services/authService';
import { partyApiService } from '../services/partyApiService';
import type { CreatePartyDto, PartyDto, UpdatePartyDto } from '../types/api';
import { getPopularTimeZones, getDefaultTimeZone } from '../utils/timezoneUtils';
import './CabinetPage.css';

const THEME_OPTIONS: { value: string; label: string }[] = [
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'sakura', label: 'Sakura' },
  { value: 'art-deco', label: 'Art Deco' },
  { value: 'basic', label: 'Базовый' },
];

const emptyForm: CreatePartyDto = {
  name: '',
  themeId: 'cyberpunk',
  isListedInCatalog: false,
};

export function CabinetPage() {
  const navigate = useNavigate();
  const [organizer, setOrganizer] = useState<OrganizerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PartyDto[]>([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreatePartyDto>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyDto | null>(null);
  const [editForm, setEditForm] = useState<UpdatePartyDto>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPartyId, setDeletingPartyId] = useState<string | null>(null);
  const [togglingPartyId, setTogglingPartyId] = useState<string | null>(null);

  const loadParties = useCallback(async () => {
    setLoadingParties(true);
    setError(null);
    try {
      const list = await partyApiService.getMyParties();
      setParties(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки вечеринок');
    } finally {
      setLoadingParties(false);
    }
  }, []);

  useEffect(() => {
    const loadOrganizer = async () => {
      try {
        const currentOrganizer = await authService.checkAuth();
        if (!currentOrganizer) {
          navigate('/login');
          return;
        }
        setOrganizer(currentOrganizer);
        setLoading(false);
        await loadParties();
      } catch (err) {
        console.error('[CabinetPage] Error checking auth:', err);
        navigate('/login');
      }
    };

    loadOrganizer();
  }, [navigate, loadParties]);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await partyApiService.createParty({
        ...createForm,
        name: createForm.name.trim(),
        eventDateTime: createForm.eventDateTime || undefined,
      });
      setShowCreateForm(false);
      setCreateForm(emptyForm);
      await loadParties();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания вечеринки');
    } finally {
      setCreating(false);
    }
  };

  const handleEditOpen = (party: PartyDto) => {
    setEditingParty(party);
    setEditForm({
      name: party.name,
      themeId: party.themeId,
      eventDateTime: party.eventDateTime,
      isListedInCatalog: party.isListedInCatalog,
      description: party.description ?? '',
      place: party.place ?? '',
      city: party.city ?? '',
      timeZone: party.timeZone ?? getDefaultTimeZone(),
    });
    setShowCreateForm(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParty) return;
    setSavingEdit(true);
    setError(null);
    try {
      await partyApiService.updatePartyMetadata(editingParty.id, editForm);
      setEditingParty(null);
      setShowCreateForm(false);
      await loadParties();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleCatalog = async (party: PartyDto) => {
    setTogglingPartyId(party.id);
    setError(null);
    try {
      await partyApiService.updatePartyMetadata(party.id, {
        isListedInCatalog: !party.isListedInCatalog,
      });
      await loadParties();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления');
    } finally {
      setTogglingPartyId(null);
    }
  };

  const handleDeleteConfirm = async (partyId: string) => {
    setDeletingPartyId(partyId);
    setError(null);
    try {
      await partyApiService.deleteParty(partyId);
      setDeletingPartyId(null);
      await loadParties();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
      setDeletingPartyId(null);
    }
  };

  if (loading || !organizer) {
    return (
      <div className="cabinet-page">
        <div className="cabinet-container">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  const partyViewUrl = (shortCode: string) => `${window.location.origin}/party/${shortCode}`;

  return (
    <div className="cabinet-page">
      <div className="cabinet-container">
        <div className="cabinet-header">
          <h1>Мой кабинет</h1>
          <button className="logout-button" onClick={handleLogout} type="button">
            Выйти
          </button>
        </div>

        <div className="organizer-info">
          {organizer.logoUrl && (
            <img src={organizer.logoUrl} alt={organizer.name} className="organizer-logo" />
          )}
          <h2>{organizer.name}</h2>
          {organizer.links && Object.keys(organizer.links).length > 0 && (
            <div className="organizer-links">
              <h3>Ссылки:</h3>
              <ul>
                {Object.entries(organizer.links).map(([key, value]) => (
                  <li key={key}>
                    <a href={String(value)} target="_blank" rel="noopener noreferrer">
                      {key}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="organizer-meta">
            <p>Дата регистрации: {new Date(organizer.createdAt).toLocaleDateString('ru-RU')}</p>
          </div>
        </div>

        <div className="cabinet-parties">
          <div className="cabinet-parties-header">
            <h3>Мои вечеринки</h3>
            <button
              type="button"
              className="cabinet-btn cabinet-btn-primary"
              onClick={() => {
                setEditingParty(null);
                setShowCreateForm(!showCreateForm);
                if (showCreateForm) setCreateForm(emptyForm);
              }}
            >
              {showCreateForm && !editingParty ? 'Отмена' : 'Создать вечеринку'}
            </button>
          </div>

          {error && (
            <div className="cabinet-error" role="alert">
              {error}
            </div>
          )}

          {(showCreateForm || editingParty) && (
            <form
              className="cabinet-form"
              onSubmit={editingParty ? handleEditSubmit : handleCreateSubmit}
            >
              <h4>{editingParty ? 'Редактировать вечеринку' : 'Новая вечеринка'}</h4>
              <label>
                Название *
                <input
                  type="text"
                  value={editingParty ? (editForm.name ?? '') : createForm.name}
                  onChange={(e) =>
                    editingParty
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
                  value={editingParty ? (editForm.themeId ?? 'cyberpunk') : createForm.themeId}
                  onChange={(e) =>
                    editingParty
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
                  value={(() => {
                    const dt = editingParty ? editForm.eventDateTime : createForm.eventDateTime;
                    if (!dt) return '';
                    try {
                      return new Date(dt).toISOString().slice(0, 16);
                    } catch {
                      return '';
                    }
                  })()}
                  onChange={(e) =>
                    editingParty
                      ? setEditForm((f) => ({
                          ...f,
                          eventDateTime: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : undefined,
                        }))
                      : setCreateForm((f) => ({
                          ...f,
                          eventDateTime: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : undefined,
                        }))
                  }
                />
              </label>
              <label>
                Таймзона
                <select
                  value={
                    editingParty
                      ? (editForm.timeZone ?? getDefaultTimeZone())
                      : (createForm.timeZone ?? getDefaultTimeZone())
                  }
                  onChange={(e) =>
                    editingParty
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
                  value={
                    editingParty ? (editForm.description ?? '') : (createForm.description ?? '')
                  }
                  onChange={(e) =>
                    editingParty
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
                  value={editingParty ? (editForm.place ?? '') : (createForm.place ?? '')}
                  onChange={(e) =>
                    editingParty
                      ? setEditForm((f) => ({ ...f, place: e.target.value }))
                      : setCreateForm((f) => ({ ...f, place: e.target.value }))
                  }
                />
              </label>
              <label>
                Город
                <input
                  type="text"
                  value={editingParty ? (editForm.city ?? '') : (createForm.city ?? '')}
                  onChange={(e) =>
                    editingParty
                      ? setEditForm((f) => ({ ...f, city: e.target.value }))
                      : setCreateForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </label>
              <label className="cabinet-checkbox">
                <input
                  type="checkbox"
                  checked={
                    editingParty
                      ? (editForm.isListedInCatalog ?? false)
                      : (createForm.isListedInCatalog ?? false)
                  }
                  onChange={(e) =>
                    editingParty
                      ? setEditForm((f) => ({ ...f, isListedInCatalog: e.target.checked }))
                      : setCreateForm((f) => ({ ...f, isListedInCatalog: e.target.checked }))
                  }
                />
                Показывать в каталоге
              </label>
              <div className="cabinet-form-actions">
                <button
                  type="button"
                  className="cabinet-btn"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingParty(null);
                    setCreateForm(emptyForm);
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="cabinet-btn cabinet-btn-primary"
                  disabled={editingParty ? savingEdit : creating}
                >
                  {editingParty
                    ? savingEdit
                      ? 'Сохранение…'
                      : 'Сохранить'
                    : creating
                      ? 'Создание…'
                      : 'Создать'}
                </button>
              </div>
            </form>
          )}

          {loadingParties ? (
            <p className="cabinet-loading">Загрузка списка…</p>
          ) : (
            <ul className="cabinet-party-list">
              {parties.map((party) => (
                <li key={party.id} className="cabinet-party-item">
                  <div className="cabinet-party-main">
                    <span className="cabinet-party-name">{party.name}</span>
                    <span className="cabinet-party-short">/{party.shortCode}</span>
                    <a
                      href={partyViewUrl(party.shortCode)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cabinet-party-link"
                    >
                      Открыть
                    </a>
                  </div>
                  <div className="cabinet-party-actions">
                    <label className="cabinet-toggle-label">
                      <input
                        type="checkbox"
                        checked={party.isListedInCatalog}
                        disabled={togglingPartyId === party.id}
                        onChange={() => handleToggleCatalog(party)}
                      />
                      В каталоге
                    </label>
                    <button
                      type="button"
                      className="cabinet-btn cabinet-btn-sm"
                      onClick={() => handleEditOpen(party)}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="cabinet-btn cabinet-btn-sm cabinet-btn-danger"
                      disabled={deletingPartyId === party.id}
                      onClick={() =>
                        window.confirm(`Удалить вечеринку «${party.name}»?`) &&
                        handleDeleteConfirm(party.id)
                      }
                    >
                      {deletingPartyId === party.id ? 'Удаление…' : 'Удалить'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!loadingParties && parties.length === 0 && !showCreateForm && !editingParty && (
            <p className="cabinet-empty">Нет вечеринок. Создайте первую.</p>
          )}
        </div>
      </div>
    </div>
  );
}
