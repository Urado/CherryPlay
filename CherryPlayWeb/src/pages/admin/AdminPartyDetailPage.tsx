import { Button, ErrorMessage } from '@cherryplay/components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import { ROUTES } from '../../constants/routes';
import { useRequireAdmin } from '../../hooks/useRequireAdmin';
import { adminApiService } from '../../services/adminApiService';
import type { AdminPartyDetailDto, PartyLifecycleState } from '../../types/api';
import { extractApiErrorMessage } from '../../utils/apiErrorHandler';
import { sanitizeExternalUrl } from '../../utils/urlSafety';

import './AdminPages.css';

const lifecycleLabels: Record<PartyLifecycleState, string> = {
  draft: 'Черновик',
  ready: 'Готова',
  completed: 'Завершена',
};
const lifecycleActions: Record<PartyLifecycleState, string> = {
  draft: 'Сделать черновиком',
  ready: 'Сделать готовой',
  completed: 'Завершить',
};

const formatValue = (value: string | null | undefined): string => value?.trim() || 'Не указано';

const formatDuration = (duration: number): string => {
  const totalSeconds = Number.isFinite(duration) ? Math.max(0, Math.floor(duration)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? `${hours} ч` : null,
    minutes > 0 ? `${minutes} мин` : null,
    seconds > 0 ? `${seconds} сек.` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(' ') : '0 сек.';
};

export const AdminPartyDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { checking, isAdmin } = useRequireAdmin();
  const [party, setParty] = useState<AdminPartyDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
  const requestIdRef = useRef(0);
  const currentPartyIdRef = useRef(id);
  currentPartyIdRef.current = id;

  const load = useCallback(async () => {
    if (!id) {
      setParty(null);
      setLoading(false);
      setError('Не указан идентификатор вечеринки.');
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiService.getPartyById(id);
      if (requestId === requestIdRef.current) setParty(result);
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setParty(null);
        setError(extractApiErrorMessage(err, 'Не удалось загрузить вечеринку'));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setSuccess(null);
    setActionLoading(false);
    setResetConfirmationOpen(false);
    if (isAdmin) void load();
  }, [isAdmin, load]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    [],
  );

  const changeLifecycle = async (state: PartyLifecycleState) => {
    if (!party) return;
    const partyId = party.id;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await adminApiService.setPartyLifecycle(party.id, state);
      if (currentPartyIdRef.current !== partyId) return;
      setParty((current) =>
        current
          ? {
              ...current,
              partyLifecycleState: result.partyLifecycleState,
              isListedInCatalog: result.isListedInCatalog,
            }
          : current,
      );
      setSuccess(`Состояние изменено: ${lifecycleLabels[result.partyLifecycleState]}.`);
    } catch (err) {
      if (currentPartyIdRef.current !== partyId) return;
      setError(extractApiErrorMessage(err, 'Не удалось изменить состояние вечеринки'));
    } finally {
      if (currentPartyIdRef.current === partyId) setActionLoading(false);
    }
  };

  const toggleCatalogVisibility = async () => {
    if (!party) return;
    const partyId = party.id;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await adminApiService.setPartyCatalogVisibility(
        party.id,
        !party.isListedInCatalog,
      );
      if (currentPartyIdRef.current !== partyId) return;
      setParty((current) =>
        current
          ? {
              ...current,
              partyLifecycleState: result.partyLifecycleState,
              isListedInCatalog: result.isListedInCatalog,
            }
          : current,
      );
      setSuccess(
        result.isListedInCatalog
          ? 'Вечеринка возвращена в каталог.'
          : 'Вечеринка скрыта из каталога.',
      );
    } catch (err) {
      if (currentPartyIdRef.current !== partyId) return;
      setError(extractApiErrorMessage(err, 'Не удалось изменить видимость вечеринки'));
    } finally {
      if (currentPartyIdRef.current === partyId) setActionLoading(false);
    }
  };

  const resetSession = async () => {
    if (!party) return;
    const partyId = party.id;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await adminApiService.resetPartySession(partyId);
      if (currentPartyIdRef.current !== partyId) return;
      setResetConfirmationOpen(false);
      setSuccess('Эфир и состояние воспроизведения сброшены. Плейлист сохранён.');
      await load();
    } catch (err) {
      if (currentPartyIdRef.current !== partyId) return;
      setError(extractApiErrorMessage(err, 'Не удалось сбросить состояние эфира'));
    } finally {
      if (currentPartyIdRef.current === partyId) setActionLoading(false);
    }
  };

  if (checking || !isAdmin) {
    return <div className="admin-page admin-page--loading">Проверка доступа…</div>;
  }

  const activeSessionWithConnectedDesktop =
    Boolean(party?.hasActiveSession) && Boolean(party?.isOrganizerConnected);
  const isReadOnly = Boolean(party?.isDeleted);
  const canResetSession = Boolean(party?.hasActiveSession || party?.playbackState);
  const safeExternalLink = sanitizeExternalUrl(party?.externalLinkUrl);

  return (
    <main className="admin-page admin-page--wide">
      <div className="admin-page__header">
        <Link to={ROUTES.ADMIN_PARTIES} className="admin-link">
          ← К списку вечеринок
        </Link>
        <h1>Карточка вечеринки</h1>
      </div>
      {error && <ErrorMessage message={error} />}
      {success && (
        <p className="admin-success" role="status">
          {success}
        </p>
      )}
      {loading ? (
        <p>Загрузка…</p>
      ) : party ? (
        <>
          <section className="admin-card">
            <div className="admin-card__header">
              <div>
                <h2>{party.title?.trim() || party.name}</h2>
                <p>
                  {party.isOrganizerDeleted ? (
                    `Организатор удалён · ${party.organizerId}`
                  ) : (
                    <Link
                      to={ROUTES.ADMIN_ORGANIZER_DETAIL(party.organizerId)}
                      className="admin-link"
                    >
                      {party.organizerName}
                    </Link>
                  )}
                </p>
              </div>
              <span className="admin-badge">{party.shortCode}</span>
            </div>
            {isReadOnly && <p role="status">Вечеринка удалена. Доступен только просмотр.</p>}
            <dl className="admin-party-details">
              <div>
                <dt>Город</dt>
                <dd>{formatValue(party.city)}</dd>
              </div>
              <div>
                <dt>Место</dt>
                <dd>{formatValue(party.place)}</dd>
              </div>
              <div>
                <dt>Дата</dt>
                <dd>
                  {party.eventDateTime
                    ? new Date(party.eventDateTime).toLocaleString('ru-RU')
                    : 'Не указана'}
                </dd>
              </div>
              <div>
                <dt>Состояние</dt>
                <dd>{lifecycleLabels[party.partyLifecycleState]}</dd>
              </div>
              <div>
                <dt>Видимость</dt>
                <dd>{party.isListedInCatalog ? 'В каталоге' : 'Скрыта из каталога'}</dd>
              </div>
              <div>
                <dt>Эфир</dt>
                <dd>{party.hasActiveSession ? 'Активен' : 'Не активен'}</dd>
              </div>
              <div>
                <dt>Десктоп</dt>
                <dd>{party.isOrganizerConnected ? 'Подключён' : 'Отключён'}</dd>
              </div>
              <div>
                <dt>Плейлист</dt>
                <dd>
                  {party.playlist.totalTracks} треков ·{' '}
                  {formatDuration(party.playlist.totalDuration)}
                </dd>
              </div>
              <div>
                <dt>Описание</dt>
                <dd>{formatValue(party.description)}</dd>
              </div>
              <div>
                <dt>Ссылка</dt>
                <dd>
                  {safeExternalLink ? (
                    <a href={safeExternalLink} target="_blank" rel="noreferrer">
                      {formatValue(party.externalLinkText) === 'Не указано'
                        ? safeExternalLink
                        : party.externalLinkText}
                    </a>
                  ) : (
                    formatValue(party.externalLinkUrl)
                  )}
                </dd>
              </div>
              {party.danceTags?.length ? (
                <div>
                  <dt>Теги</dt>
                  <dd>{party.danceTags.join(', ')}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="admin-card">
            <h3>Управление вечеринкой</h3>
            {activeSessionWithConnectedDesktop && !isReadOnly && (
              <p role="status">
                Сначала завершите эфир или отключите десктоп организатора, чтобы изменить состояние
                или сбросить эфир.
              </p>
            )}
            {isReadOnly ? (
              <p>Изменение состояния, видимости и эфира недоступно для удалённой вечеринки.</p>
            ) : (
              <div className="admin-party-management-actions">
                <strong>Состояние: {lifecycleLabels[party.partyLifecycleState]}</strong>
                {(Object.keys(lifecycleActions) as PartyLifecycleState[])
                  .filter((state) => state !== party.partyLifecycleState)
                  .map((state) => (
                    <Button
                      key={state}
                      variant="secondary"
                      size="sm"
                      type="button"
                      disabled={actionLoading || activeSessionWithConnectedDesktop}
                      onClick={() => void changeLifecycle(state)}
                    >
                      {lifecycleActions[state]}
                    </Button>
                  ))}
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void toggleCatalogVisibility()}
                >
                  {party.isListedInCatalog ? 'Скрыть из каталога' : 'Вернуть в каталог'}
                </Button>
                {canResetSession && (
                  <Button
                    variant="danger"
                    size="sm"
                    type="button"
                    disabled={actionLoading || activeSessionWithConnectedDesktop}
                    onClick={() => setResetConfirmationOpen(true)}
                  >
                    Сбросить эфир и воспроизведение
                  </Button>
                )}
              </div>
            )}
          </section>
          {party.subtitle && (
            <section className="admin-card">
              <h3>Подзаголовок</h3>
              <p>{party.subtitle}</p>
            </section>
          )}
          {party.shortDescription && (
            <section className="admin-card">
              <h3>Краткое описание</h3>
              <p>{party.shortDescription}</p>
            </section>
          )}
        </>
      ) : (
        <section className="admin-card">
          <p>Вечеринка не найдена.</p>
          <Button variant="secondary" size="sm" type="button" onClick={() => void load()}>
            Повторить
          </Button>
        </section>
      )}
      <ConfirmActionDialog
        open={resetConfirmationOpen}
        title="Сбросить эфир?"
        description="Эфир и сохранённое состояние воспроизведения будут сброшены. Плейлист, название, статус и видимость вечеринки сохранятся."
        confirmLabel="Сбросить эфир"
        confirming={actionLoading}
        onConfirm={() => void resetSession()}
        onCancel={() => setResetConfirmationOpen(false)}
      />
    </main>
  );
};
