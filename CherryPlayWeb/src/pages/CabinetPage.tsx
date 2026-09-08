import {
  Button,
  ChangePasswordForm,
  DEFAULT_PARTY_THEME_ID,
  REQUIRED_CONSENT_DOCUMENTS,
  type OrganizerDto,
} from '@cherryplay/components';
import { getDefaultTimeZone, sortPartiesByEventDateDesc } from '@cherryplay/components';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { PRIVACY_CONTACT_EMAIL } from '../constants/legalContacts';
import { ROUTES } from '../constants/routes';
import { useConsentGate } from '../contexts/ConsentGateContext';
import { clearThemeAccessCache, useThemeAccess } from '../hooks/useThemeAccess';
import { deleteOrganizerAccount } from '../services/accountApiService';
import { authService } from '../services/authService';
import {
  createConsentEvents,
  listConsentEvents,
  type ConsentEventDto,
} from '../services/consentEventsService';
import { partyApiService } from '../services/partyApiService';
import type { CreatePartyDto, PartyDto, PartyLifecycleState, UpdatePartyDto } from '../types/api';
import { extractApiErrorMessage } from '../utils/apiErrorHandler';
import { formatConsentDecisionLabel } from '../utils/consentDecisionLabel';
import { sanitizeExternalUrl } from '../utils/urlSafety';

import { CabinetPartyForm } from './CabinetPartyForm';
import { CabinetPartyList } from './CabinetPartyList';
import './CabinetPage.css';

type OrganizerWithRole = OrganizerDto & { role?: 'organizer' | 'admin' };
type CabinetLocationState = { deniedToast?: string; error?: string } | null;

const emptyForm: CreatePartyDto = {
  name: '',
  partyThemeId: DEFAULT_PARTY_THEME_ID,
  isListedInCatalog: false,
  timeZone: getDefaultTimeZone(),
  shortDescription: '',
  externalLinkUrl: '',
  externalLinkText: '',
  danceTags: [],
};

function mergePartiesWithLocalDrafts(current: PartyDto[], fromServer: PartyDto[]): PartyDto[] {
  const serverIds = new Set(fromServer.map((party) => party.id));
  const localDrafts = current.filter(
    (party) => party.partyLifecycleState === 'draft' && !serverIds.has(party.id),
  );
  return [...localDrafts, ...sortPartiesByEventDateDesc(fromServer)];
}

export function CabinetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { ensureConsents } = useConsentGate();
  const [organizer, setOrganizer] = useState<OrganizerWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PartyDto[]>([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partiesOpen, setPartiesOpen] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreatePartyDto>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyDto | null>(null);
  const [expandedPartyId, setExpandedPartyId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdatePartyDto>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPartyId, setDeletingPartyId] = useState<string | null>(null);
  const [togglingPartyId, setTogglingPartyId] = useState<string | null>(null);
  const [transitioningPartyId, setTransitioningPartyId] = useState<string | null>(null);
  const [transitioningTargetState, setTransitioningTargetState] =
    useState<PartyLifecycleState | null>(null);
  const [themeSelectionError, setThemeSelectionError] = useState<string | null>(null);
  const [lockedThemeCtaUrl, setLockedThemeCtaUrl] = useState<string | null>(null);
  const [deniedToastMessage, setDeniedToastMessage] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(() => location.hash === '#account');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [consentEvents, setConsentEvents] = useState<ConsentEventDto[] | null>(null);
  const [consentUnavailable, setConsentUnavailable] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const accountSectionRef = useRef<HTMLDetailsElement>(null);
  const deleteAccountDescId = useId();
  const deleteAccountWarningId = useId();
  const { data: themeAccess, error: themeAccessError } = useThemeAccess(
    !!organizer,
    organizer?.id ?? null,
  );

  const loadParties = useCallback(async () => {
    setLoadingParties(true);
    setError(null);
    try {
      const list = await partyApiService.getMyParties();
      setParties((current) => mergePartiesWithLocalDrafts(current, list));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки вечеринок');
    } finally {
      setLoadingParties(false);
    }
  }, []);

  useEffect(() => {
    if (location.hash === '#account') {
      setAccountOpen(true);
      accountSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  const loadConsentEvents = useCallback(async () => {
    try {
      const events = await listConsentEvents();
      setConsentEvents(events);
      setConsentUnavailable(false);
    } catch {
      setConsentEvents(null);
      setConsentUnavailable(true);
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
        await ensureConsents();
        await loadParties();
        await loadConsentEvents();
      } catch (err) {
        console.error('[CabinetPage] Error checking auth:', err);
        navigate(ROUTES.LOGIN);
      }
    };

    loadOrganizer();
  }, [navigate, loadParties, ensureConsents, loadConsentEvents]);

  const handleLogout = async () => {
    await authService.logout();
    clearThemeAccessCache();
    navigate(ROUTES.LOGIN);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setPrivacyError(null);
    try {
      await deleteOrganizerAccount();
      clearThemeAccessCache();
      await authService.logout();
      navigate(ROUTES.LOGIN, { replace: true, state: { accountDeleted: true } });
    } catch (e) {
      setPrivacyError(extractApiErrorMessage(e, 'Не удалось удалить аккаунт'));
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
    }
  };

  const openWithdrawDialog = () => {
    if (!consentEvents) {
      return;
    }

    const activeGrants = REQUIRED_CONSENT_DOCUMENTS.filter((doc) => {
      const latest = consentEvents
        .filter((event) => event.legalDocumentVersionId === doc.versionId)
        .sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime())[0];
      return latest?.decision === 'grant';
    });

    if (activeGrants.length === 0) {
      setPrivacyError('Нет активных согласий для отзыва.');
      return;
    }

    setPrivacyError(null);
    setWithdrawDialogOpen(true);
  };

  const handleWithdrawConsents = async () => {
    if (!consentEvents) {
      return;
    }

    const activeGrants = REQUIRED_CONSENT_DOCUMENTS.filter((doc) => {
      const latest = consentEvents
        .filter((event) => event.legalDocumentVersionId === doc.versionId)
        .sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime())[0];
      return latest?.decision === 'grant';
    });

    if (activeGrants.length === 0) {
      setPrivacyError('Нет активных согласий для отзыва.');
      setWithdrawDialogOpen(false);
      return;
    }

    setWithdrawing(true);
    setPrivacyError(null);
    try {
      await createConsentEvents(
        activeGrants.map((doc) => ({
          id: crypto.randomUUID(),
          legalDocumentVersionId: doc.versionId,
          documentHash: doc.contentHash,
          decision: 'withdraw' as const,
        })),
      );
      await loadConsentEvents();
      setWithdrawDialogOpen(false);
    } catch (e) {
      setPrivacyError(
        extractApiErrorMessage(
          e,
          `Не удалось отозвать согласие. Напишите на ${PRIVACY_CONTACT_EMAIL}`,
        ),
      );
      setWithdrawDialogOpen(false);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleChangePasswordSuccess = () => {
    void (async () => {
      clearThemeAccessCache();
      await authService.logout();
      navigate(ROUTES.LOGIN, { replace: true, state: { passwordChanged: true } });
    })();
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
      const created = await partyApiService.createParty({
        ...createForm,
        name: createForm.name.trim(),
        eventDateTime: createForm.eventDateTime || undefined,
      });
      setParties((prev) => [created, ...prev.filter((party) => party.id !== created.id)]);
      setShowCreateForm(false);
      setCreateForm(emptyForm);
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

  const handleLifecycleTransition = async (partyId: string, targetState: PartyLifecycleState) => {
    setTransitioningPartyId(partyId);
    setTransitioningTargetState(targetState);
    setError(null);
    try {
      const updated = await partyApiService.transitionPartyLifecycle(partyId, targetState);
      setParties((prev) => prev.map((party) => (party.id === partyId ? updated : party)));
      if (editingParty?.id === partyId) {
        setEditingParty(updated);
      }
    } catch (e) {
      setError(extractApiErrorMessage(e, 'Ошибка смены состояния вечеринки'));
    } finally {
      setTransitioningPartyId(null);
      setTransitioningTargetState(null);
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => navigate(ROUTES.ADMIN_ORGANIZERS)}
              >
                Админка
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="logout-button"
              onClick={handleLogout}
            >
              Выйти
            </Button>
          </div>
        </div>

        <section className="cabinet-profile" aria-label="Профиль организатора">
          {organizer.logoUrl && <img src={organizer.logoUrl} alt="" className="organizer-logo" />}
          <div className="cabinet-profile-body">
            <div className="cabinet-profile-main">
              <h2 className="cabinet-profile-name">{organizer.name}</h2>
              <p className="organizer-meta">
                Регистрация: {new Date(organizer.createdAt).toLocaleDateString('ru-RU')}
              </p>
            </div>
            {organizer.links && Object.keys(organizer.links).length > 0 && (
              <ul className="organizer-links">
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
            )}
          </div>
        </section>

        <details
          className="cabinet-accordion"
          open={partiesOpen}
          onToggle={(e) => setPartiesOpen(e.currentTarget.open)}
          aria-labelledby="cabinet-parties-heading"
        >
          <summary className="cabinet-accordion-summary">
            <span className="cabinet-accordion-summary-row">
              <h2 id="cabinet-parties-heading" className="cabinet-section-title">
                Мои вечеринки
              </h2>
              <Button
                type="button"
                variant={showCreateForm ? 'secondary' : 'primary'}
                size="sm"
                className="cabinet-create-party-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPartiesOpen(true);
                  setEditingParty(null);
                  setShowCreateForm(!showCreateForm);
                  if (showCreateForm) setCreateForm(emptyForm);
                }}
              >
                {showCreateForm ? 'Отмена' : 'Создать вечеринку'}
              </Button>
            </span>
          </summary>

          <div className="cabinet-accordion-body">
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
                transitioningPartyId={transitioningPartyId}
                transitioningTargetState={transitioningTargetState}
                onLifecycleTransition={handleLifecycleTransition}
              />
            )}
            {!loadingParties && parties.length === 0 && !showCreateForm && !expandedPartyId && (
              <p className="cabinet-empty">Нет вечеринок. Создайте первую.</p>
            )}
          </div>
        </details>

        <details
          ref={accountSectionRef}
          id="account"
          className="cabinet-accordion cabinet-account-section"
          aria-labelledby="cabinet-account-heading"
          open={accountOpen}
          onToggle={(event) => setAccountOpen((event.target as HTMLDetailsElement).open)}
        >
          <summary className="cabinet-accordion-summary">
            <h2 id="cabinet-account-heading" className="cabinet-section-title">
              Аккаунт
            </h2>
          </summary>
          <div className="cabinet-accordion-body">
            <ChangePasswordForm
              authService={authService}
              onSuccess={handleChangePasswordSuccess}
              layout="embedded"
            />

            <section className="cabinet-privacy" aria-labelledby="cabinet-privacy-heading">
              <h3 id="cabinet-privacy-heading" className="cabinet-privacy-title">
                Конфиденциальность
              </h3>
              <p className="cabinet-privacy-text">
                Запросы субъекта ПДн (доступ, уточнение, отзыв, уничтожение) — через{' '}
                <Link to={ROUTES.LEGAL}>реквизиты и контакты</Link> или письмо на{' '}
                <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
              </p>

              {consentUnavailable && (
                <p className="cabinet-privacy-text cabinet-privacy-text--muted">
                  Журнал согласий сейчас недоступен на сервере. Отзыв — через privacy-канал.
                </p>
              )}

              {consentEvents && (
                <div className="cabinet-privacy-consents">
                  <p className="cabinet-privacy-text">Принятые документы (последнее решение):</p>
                  <ul className="cabinet-privacy-list">
                    {REQUIRED_CONSENT_DOCUMENTS.map((doc) => {
                      const latest = consentEvents
                        .filter((event) => event.legalDocumentVersionId === doc.versionId)
                        .sort(
                          (a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime(),
                        )[0];
                      return (
                        <li key={doc.versionId}>
                          {doc.title}: {formatConsentDecisionLabel(latest?.decision)}
                          {latest ? ` (${new Date(latest.eventAt).toLocaleDateString()})` : ''}
                        </li>
                      );
                    })}
                  </ul>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={withdrawing}
                    disabled={withdrawing || deletingAccount}
                    onClick={openWithdrawDialog}
                  >
                    Отозвать активные согласия
                  </Button>
                </div>
              )}

              {privacyError && (
                <p className="cabinet-privacy-error" role="alert">
                  {privacyError}
                </p>
              )}

              <div className="cabinet-privacy-delete">
                <p id={deleteAccountDescId} className="cabinet-privacy-text">
                  Удаление аккаунта обезличивает профиль; вечеринки могут остаться в каталоге без
                  ваших контактов. Вход станет невозможен.
                </p>
                {deleteDialogOpen && (
                  <p
                    id={deleteAccountWarningId}
                    className="cabinet-privacy-warning"
                    role="status"
                    aria-live="polite"
                  >
                    Подтвердите удаление в диалоге: действие необратимо.
                  </p>
                )}
                <div className="cabinet-privacy-delete-actions">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    loading={deletingAccount}
                    disabled={deletingAccount}
                    aria-describedby={
                      deleteDialogOpen
                        ? `${deleteAccountDescId} ${deleteAccountWarningId}`
                        : deleteAccountDescId
                    }
                    onClick={() => {
                      setPrivacyError(null);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    Удалить аккаунт
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </details>
      </div>

      <ConfirmActionDialog
        open={deleteDialogOpen}
        title="Удалить аккаунт?"
        description="Профиль будет обезличен, вход станет невозможен. Вечеринки могут остаться в каталоге без ваших контактов. Это действие необратимо."
        confirmLabel="Удалить навсегда"
        confirming={deletingAccount}
        onCancel={() => {
          if (!deletingAccount) {
            setDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handleDeleteAccount();
        }}
      />

      <ConfirmActionDialog
        open={withdrawDialogOpen}
        title="Отозвать согласия?"
        description="После отзыва может потребоваться заново принять документы, чтобы пользоваться сервисом. Запросы по ПДн по-прежнему можно направить на privacy-контакт."
        confirmLabel="Отозвать"
        confirmVariant="secondary"
        confirming={withdrawing}
        onCancel={() => {
          if (!withdrawing) {
            setWithdrawDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handleWithdrawConsents();
        }}
      />
    </div>
  );
}
