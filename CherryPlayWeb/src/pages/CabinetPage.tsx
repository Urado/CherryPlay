import type { OrganizerDto } from '@cherryplay/components';
import { getDefaultTimeZone } from '@cherryplay/components';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { clearThemeAccessCache, useThemeAccess } from '../hooks/useThemeAccess';
import { authService } from '../services/authService';
import { partyApiService } from '../services/partyApiService';
import type { CreatePartyDto, PartyDto, UpdatePartyDto } from '../types/api';
import { sanitizeExternalUrl } from '../utils/urlSafety';

import { CabinetPartyForm } from './CabinetPartyForm';
import { CabinetPartyList } from './CabinetPartyList';
import './CabinetPage.css';

type OrganizerWithRole = OrganizerDto & { role?: 'organizer' | 'admin' };
type CabinetLocationState = { deniedToast?: string; error?: string } | null;

const emptyForm: CreatePartyDto = {
  name: '',
  partyThemeId: 'basic',
  isListedInCatalog: false,
  timeZone: getDefaultTimeZone(),
  shortDescription: '',
  externalLinkUrl: '',
  externalLinkText: '',
  danceTags: [],
};

export function CabinetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [organizer, setOrganizer] = useState<OrganizerWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PartyDto[]>([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreatePartyDto>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyDto | null>(null);
  const [expandedPartyId, setExpandedPartyId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdatePartyDto>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPartyId, setDeletingPartyId] = useState<string | null>(null);
  const [togglingPartyId, setTogglingPartyId] = useState<string | null>(null);
  const [themeSelectionError, setThemeSelectionError] = useState<string | null>(null);
  const [lockedThemeCtaUrl, setLockedThemeCtaUrl] = useState<string | null>(null);
  const [deniedToastMessage, setDeniedToastMessage] = useState<string | null>(null);
  const { data: themeAccess, error: themeAccessError } = useThemeAccess(
    !!organizer,
    organizer?.id ?? null,
  );

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
        const currentOrganizer = (await authService.checkAuth()) as OrganizerWithRole | null;
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
    clearThemeAccessCache();
    navigate(ROUTES.LOGIN);
  };

  useEffect(() => {
    const state = location.state as CabinetLocationState;
    if (state?.deniedToast) {
      setDeniedToastMessage(state.deniedToast);
      navigate(location.pathname, { replace: true });
      return;
    }

    if (state?.error) {
      setError(state.error);
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!deniedToastMessage) return;
    const timeoutId = window.setTimeout(() => setDeniedToastMessage(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [deniedToastMessage]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      setThemeSelectionError(null);
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
      title: party.title,
      subtitle: party.subtitle,
      partyThemeId: party.partyThemeId,
      eventDateTime: party.eventDateTime,
      isListedInCatalog: party.isListedInCatalog,
      description: party.description ?? '',
      place: party.place ?? '',
      city: party.city ?? '',
      timeZone: party.timeZone ?? getDefaultTimeZone(),
      shortDescription: party.shortDescription ?? '',
      externalLinkUrl: party.externalLinkUrl ?? '',
      externalLinkText: party.externalLinkText ?? '',
      danceTags: party.danceTags ? [...party.danceTags] : [],
    });
    setExpandedPartyId(party.id);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParty) return;
    setSavingEdit(true);
    setError(null);
    try {
      setThemeSelectionError(null);
      await partyApiService.updatePartyMetadata(editingParty.id, editForm);
      setEditingParty(null);
      setExpandedPartyId(null);
      await loadParties();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSelectLockedTheme = (themeId: string) => {
    const lockedTheme = themeAccess?.visibleLockedThemes.find((item) => item.themeId === themeId);
    if (!lockedTheme) return;

    const safeContactUrl = sanitizeExternalUrl(themeAccess?.contactUrl);
    setLockedThemeCtaUrl(safeContactUrl);
    setThemeSelectionError(
      safeContactUrl
        ? `Тема доступна в пакете "${lockedTheme.packageName}". Свяжитесь с администратором.`
        : `Тема доступна в пакете "${lockedTheme.packageName}". Обратитесь к администратору для подключения пакета.`,
    );
  };

  const handleEditCancel = () => {
    setEditingParty(null);
    setExpandedPartyId(null);
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
      {deniedToastMessage && (
        <div className="cabinet-toast" role="status" aria-live="polite">
          {deniedToastMessage}
        </div>
      )}
      <div className="cabinet-container">
        <div className="cabinet-header">
          <h1>Мой кабинет</h1>
          <div className="cabinet-header-actions">
            {organizer.role === 'admin' && (
              <button
                type="button"
                className="cabinet-btn"
                onClick={() => navigate(ROUTES.ADMIN_ORGANIZERS)}
              >
                Админка
              </button>
            )}
            <button className="logout-button" onClick={handleLogout} type="button">
              Выйти
            </button>
          </div>
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
                {Object.entries(organizer.links).map(([key, value]) => {
                  const originalUrl = String(value);
                  const safeUrl = sanitizeExternalUrl(originalUrl);

                  return (
                    <li key={key}>
                      {safeUrl ? (
                        <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                          {key}
                        </a>
                      ) : (
                        <span>
                          {key}: {originalUrl}
                        </span>
                      )}
                    </li>
                  );
                })}
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
              {showCreateForm ? 'Отмена' : 'Создать вечеринку'}
            </button>
          </div>

          {error && (
            <div className="cabinet-error" role="alert">
              {error}
            </div>
          )}
          {themeSelectionError && lockedThemeCtaUrl && (
            <div className="cabinet-error" role="alert">
              <div>{themeSelectionError}</div>
              <a href={lockedThemeCtaUrl} target="_blank" rel="noopener noreferrer">
                Написать администратору
              </a>
            </div>
          )}
          {themeSelectionError && !lockedThemeCtaUrl && (
            <div className="cabinet-error" role="alert">
              {themeSelectionError}
            </div>
          )}

          {showCreateForm && (
            <CabinetPartyForm
              editingParty={null}
              editForm={editForm}
              createForm={createForm}
              setEditForm={setEditForm}
              setCreateForm={setCreateForm}
              savingEdit={false}
              creating={creating}
              themeAccess={themeAccess}
              themeAccessError={themeAccessError}
              onSelectLockedTheme={handleSelectLockedTheme}
              onSubmit={handleCreateSubmit}
              onCancel={() => {
                setShowCreateForm(false);
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
              expandedPartyId={expandedPartyId}
              editingParty={editingParty}
              editForm={editForm}
              setEditForm={setEditForm}
              savingEdit={savingEdit}
              themeAccess={themeAccess}
              themeAccessError={themeAccessError}
              onSelectLockedTheme={handleSelectLockedTheme}
              onEdit={handleEditOpen}
              onEditSubmit={handleEditSubmit}
              onEditCancel={handleEditCancel}
              onToggleCatalog={handleToggleCatalog}
              onDeleteConfirm={handleDeleteConfirm}
            />
          )}
          {!loadingParties && parties.length === 0 && !showCreateForm && !expandedPartyId && (
            <p className="cabinet-empty">Нет вечеринок. Создайте первую.</p>
          )}
        </div>
      </div>
    </div>
  );
}
