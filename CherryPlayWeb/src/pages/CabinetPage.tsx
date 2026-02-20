import type { OrganizerDto } from '@cherryplay/components';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { authService } from '../services/authService';
import { partyApiService } from '../services/partyApiService';
import type { CreatePartyDto, PartyDto, UpdatePartyDto } from '../types/api';
import { getDefaultTimeZone } from '../utils/timezoneUtils';

import { CabinetPartyForm } from './CabinetPartyForm';
import { CabinetPartyList } from './CabinetPartyList';
import './CabinetPage.css';

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
          navigate(ROUTES.LOGIN);
          return;
        }
        setOrganizer(currentOrganizer);
        setLoading(false);
        await loadParties();
      } catch (err) {
        console.error('[CabinetPage] Error checking auth:', err);
        navigate(ROUTES.LOGIN);
      }
    };

    loadOrganizer();
  }, [navigate, loadParties]);

  const handleLogout = async () => {
    await authService.logout();
    navigate(ROUTES.LOGIN);
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
            <CabinetPartyForm
              editingParty={editingParty}
              editForm={editForm}
              createForm={createForm}
              setEditForm={setEditForm}
              setCreateForm={setCreateForm}
              savingEdit={savingEdit}
              creating={creating}
              onSubmit={editingParty ? handleEditSubmit : handleCreateSubmit}
              onCancel={() => {
                setShowCreateForm(false);
                setEditingParty(null);
                setCreateForm(emptyForm);
              }}
            />
          )}

          {loadingParties ? (
            <p className="cabinet-loading">Загрузка списка…</p>
          ) : (
            <CabinetPartyList
              parties={parties}
              togglingPartyId={togglingPartyId}
              deletingPartyId={deletingPartyId}
              onEdit={handleEditOpen}
              onToggleCatalog={handleToggleCatalog}
              onDeleteConfirm={handleDeleteConfirm}
            />
          )}
          {!loadingParties && parties.length === 0 && !showCreateForm && !editingParty && (
            <p className="cabinet-empty">Нет вечеринок. Создайте первую.</p>
          )}
        </div>
      </div>
    </div>
  );
}
