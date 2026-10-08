import { Button, ErrorMessage, FormSelect, FormTextarea } from '@cherryplay/components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useRequireAdmin } from '../../hooks/useRequireAdmin';
import { adminApiService } from '../../services/adminApiService';
import type {
  AdminOrganizerDetailDto,
  CreateEntitlementRevocationRequest,
  EntitlementDto,
  EntitlementRevocationDto,
  ThemePackageDto,
} from '../../types/api';
import { extractApiErrorMessage } from '../../utils/apiErrorHandler';

import './AdminPages.css';

function getPendingRevocationKey(entitlementId: string): string {
  return `admin-entitlement-revocation:${entitlementId}`;
}

function readPendingRevocation(
  entitlementId: string,
): CreateEntitlementRevocationRequest | null {
  try {
    const serialized = window.sessionStorage.getItem(getPendingRevocationKey(entitlementId));
    if (!serialized) return null;

    const value: unknown = JSON.parse(serialized);
    if (
      !value ||
      typeof value !== 'object' ||
      !('id' in value) ||
      typeof value.id !== 'string' ||
      !('entitlementId' in value) ||
      value.entitlementId !== entitlementId ||
      ('note' in value && value.note !== undefined && typeof value.note !== 'string')
    ) {
      window.sessionStorage.removeItem(getPendingRevocationKey(entitlementId));
      return null;
    }

    return {
      id: value.id,
      entitlementId,
      note: 'note' in value && typeof value.note === 'string' ? value.note : undefined,
    };
  } catch {
    return null;
  }
}

function persistPendingRevocation(request: CreateEntitlementRevocationRequest): boolean {
  try {
    window.sessionStorage.setItem(
      getPendingRevocationKey(request.entitlementId),
      JSON.stringify(request),
    );
    return true;
  } catch {
    return false;
  }
}

function clearPendingRevocation(entitlementId: string): void {
  try {
    window.sessionStorage.removeItem(getPendingRevocationKey(entitlementId));
  } catch {
    return;
  }
}

function isDefinitiveRevocationRejection(error: unknown): error is { status: number } {
  if (!error || typeof error !== 'object' || !('status' in error)) return false;
  return typeof error.status === 'number' && [400, 401, 403, 404, 409, 422].includes(error.status);
}

function isActiveEntitlement(entitlement: EntitlementDto): boolean {
  if (entitlement.revokedAt) return false;
  if (!entitlement.expiresAt) return true;
  return new Date(entitlement.expiresAt).getTime() > Date.now();
}

export const AdminOrganizerDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { checking, isAdmin } = useRequireAdmin();
  const loadRequestIdRef = useRef(0);
  const revocationHistoryRequestIdsRef = useRef<Record<string, number>>({});
  const [organizer, setOrganizer] = useState<AdminOrganizerDetailDto | null>(null);
  const [packages, setPackages] = useState<ThemePackageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revocations, setRevocations] = useState<Record<string, EntitlementRevocationDto[]>>({});
  const [revocationHistoryErrors, setRevocationHistoryErrors] = useState<Record<string, string>>({});
  const [revocationHistoryLoadingIds, setRevocationHistoryLoadingIds] = useState<
    Record<string, boolean>
  >({});

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantPackageId, setGrantPackageId] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);

  const [revokeEntitlement, setRevokeEntitlement] = useState<EntitlementDto | null>(null);
  const [revokeNote, setRevokeNote] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokePersistenceWarning, setRevokePersistenceWarning] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revocationRequestId, setRevocationRequestId] = useState<string | null>(null);
  const [revocationPending, setRevocationPending] = useState(false);
  const grantOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const revokeOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const grantModalTitleId = 'admin-grant-modal-title';
  const revokeModalTitleId = 'admin-revoke-modal-title';

  const loadRevocationHistory = useCallback(async (entitlementIds: string[]) => {
    const requestId = loadRequestIdRef.current;
    const requestSequences = entitlementIds.map((entitlementId) => {
      const sequence = (revocationHistoryRequestIdsRef.current[entitlementId] ?? 0) + 1;
      revocationHistoryRequestIdsRef.current[entitlementId] = sequence;
      return sequence;
    });
    setRevocationHistoryLoadingIds((current) => ({
      ...current,
      ...Object.fromEntries(entitlementIds.map((entitlementId) => [entitlementId, true])),
    }));
    const results = await Promise.allSettled(
      entitlementIds.map(async (entitlementId) => ({
        entitlementId,
        events: await adminApiService.getEntitlementRevocations(entitlementId),
      })),
    );
    if (requestId !== loadRequestIdRef.current) return;

    results.forEach((result, index) => {
      const entitlementId = entitlementIds[index];
      const sequence = requestSequences[index];
      if (
        !entitlementId ||
        sequence === undefined ||
        revocationHistoryRequestIdsRef.current[entitlementId] !== sequence
      ) {
        return;
      }
      if (result.status === 'fulfilled') {
        setRevocations((current) => ({ ...current, [entitlementId]: result.value.events }));
        setRevocationHistoryErrors((current) => {
          const next = { ...current };
          delete next[entitlementId];
          return next;
        });
      } else {
        setRevocationHistoryErrors((current) => ({
          ...current,
          [entitlementId]: extractApiErrorMessage(
            result.reason,
            'Не удалось загрузить историю отзывов.',
          ),
        }));
      }
      setRevocationHistoryLoadingIds((current) => {
        const next = { ...current };
        delete next[entitlementId];
        return next;
      });
    });
  }, []);

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;

    if (!id) {
      if (requestId === loadRequestIdRef.current) {
        setOrganizer(null);
        setLoading(false);
        setError('Не указан organizerId.');
      }
      return;
    }

    setLoading(true);
    setError(null);
    setRevocations({});
    setRevocationHistoryErrors({});
    setRevocationHistoryLoadingIds({});
    revocationHistoryRequestIdsRef.current = {};
    try {
      const [organizerData, packageData] = await Promise.all([
        adminApiService.getOrganizerById(id),
        adminApiService.getThemePackages(),
      ]);
      if (requestId !== loadRequestIdRef.current) return;
      setOrganizer(organizerData);
      void loadRevocationHistory(organizerData.entitlements.map((entitlement) => entitlement.id));
      const grantablePackages = packageData.items.filter(
        (item) => item.isActive && !item.isAutoGranted,
      );
      setPackages(grantablePackages);
      setGrantPackageId((current) => {
        if (current && grantablePackages.some((pkg) => pkg.id === current)) {
          return current;
        }
        return grantablePackages[0]?.id ?? '';
      });
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;
      setOrganizer(null);
      setError(extractApiErrorMessage(err, 'Не удалось загрузить данные'));
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [id, loadRevocationHistory]);

  useEffect(() => {
    if (!isAdmin || !id) return;
    void load();
  }, [id, isAdmin, load]);

  useEffect(
    () => () => {
      loadRequestIdRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!grantOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !granting) {
        setGrantOpen(false);
        setGrantError(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [grantOpen, granting]);

  useEffect(() => {
    if (!revokeEntitlement) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !revoking) {
        setRevokeEntitlement(null);
        setRevokeError(null);
        setRevocationRequestId(null);
        setRevocationPending(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [revokeEntitlement, revoking]);

  const activeEntitlements = useMemo(
    () => (organizer?.entitlements ?? []).filter(isActiveEntitlement),
    [organizer?.entitlements],
  );
  const historyEntitlements = useMemo(
    () => organizer?.entitlements ?? [],
    [organizer?.entitlements],
  );
  const openRevocation = (entitlement: EntitlementDto) => {
    revokeOpenButtonRef.current = document.activeElement as HTMLButtonElement | null;
    const pendingRequest = readPendingRevocation(entitlement.id);
    setRevokeEntitlement(entitlement);
    setRevokeNote(pendingRequest?.note ?? '');
    setRevokeError(null);
    setRevokePersistenceWarning(null);
    setRevocationRequestId(pendingRequest?.id ?? crypto.randomUUID());
    setRevocationPending(pendingRequest !== null);
  };

  if (checking || !isAdmin) {
    return <div className="admin-page admin-page--loading">Проверка доступа…</div>;
  }

  if (!id) {
    return <div className="admin-page">Не указан organizerId.</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <Link to={ROUTES.ADMIN_ORGANIZERS} className="admin-link">
          ← К списку организаторов
        </Link>
        <h1>Карточка организатора</h1>
      </div>

      {revokePersistenceWarning && (
        <ErrorMessage message={revokePersistenceWarning} />
      )}

      {error && (
        <ErrorMessage message={error} />
      )}

      {loading ? (
        <p>Загрузка…</p>
      ) : error ? (
        <section className="admin-card" aria-live="polite">
          <p>Не удалось загрузить карточку организатора.</p>
          <div className="admin-modal__actions admin-modal__actions--start">
            <Button variant="primary" size="sm" type="button" onClick={() => void load()}>
              Повторить
            </Button>
          </div>
        </section>
      ) : !organizer ? (
        <section className="admin-card">
          <p>Организатор не найден.</p>
        </section>
      ) : (
        <>
          <section className="admin-card">
            <h2>{organizer.name}</h2>
            <p>Email: {organizer.email ?? 'нет'}</p>
            <p>Роль: {organizer.role}</p>
            <p>Дата регистрации: {new Date(organizer.createdAt).toLocaleString('ru-RU')}</p>
          </section>

          <section className="admin-card">
            <div className="admin-card__header">
              <h3>Активные доступы</h3>
              <Button
                ref={grantOpenButtonRef}
                variant="primary"
                size="sm"
                type="button"
                onClick={() => setGrantOpen(true)}
              >
                Выдать пакет
              </Button>
            </div>
            {activeEntitlements.length ? (
              <ul className="admin-entitlement-list">
                {activeEntitlements.map((entitlement) => (
                  <li key={entitlement.id}>
                    <div>
                      <strong>{entitlement.packageName}</strong> ({entitlement.packageCode})
                      <div>
                        Выдан: {new Date(entitlement.grantedAt).toLocaleString('ru-RU')}
                        {entitlement.note ? ` · ${entitlement.note}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      type="button"
                      onClick={() => openRevocation(entitlement)}
                    >
                      Отозвать
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Нет активных доступов.</p>
            )}
          </section>

          <details className="admin-card">
            <summary>История доступов</summary>
            {historyEntitlements.length ? (
              <ul className="admin-entitlement-list">
                {historyEntitlements.map((entitlement) => (
                  <li key={entitlement.id}>
                    <div>
                      <strong>{entitlement.packageName}</strong> ({entitlement.packageCode})
                      <div>
                        Выдан: {new Date(entitlement.grantedAt).toLocaleString('ru-RU')}
                        {entitlement.revokedAt
                          ? ` · Отозван: ${new Date(entitlement.revokedAt).toLocaleString('ru-RU')}`
                          : isActiveEntitlement(entitlement)
                            ? ' · Активен'
                            : entitlement.expiresAt
                              ? ` · Истёк: ${new Date(entitlement.expiresAt).toLocaleString('ru-RU')}`
                              : ''}
                      </div>
                      {revocationHistoryLoadingIds[entitlement.id] && (
                        <div>Загрузка истории отзывов…</div>
                      )}
                      {revocations[entitlement.id]?.map((revocation) => (
                        <div key={revocation.id}>
                          Отзыв: {new Date(revocation.createdAt).toLocaleString('ru-RU')}
                          {revocation.note ? ` · Причина: ${revocation.note}` : ''}
                        </div>
                      ))}
                      {revocationHistoryErrors[entitlement.id] && (
                        <div>
                          <ErrorMessage message={revocationHistoryErrors[entitlement.id]} />
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            disabled={revocationHistoryLoadingIds[entitlement.id]}
                            onClick={() => void loadRevocationHistory([entitlement.id])}
                          >
                            Повторить загрузку истории
                          </Button>
                        </div>
                      )}
                    </div>
                    {readPendingRevocation(entitlement.id) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => openRevocation(entitlement)}
                      >
                        Повторить отзыв
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>История пуста.</p>
            )}
          </details>
        </>
      )}

      {grantOpen && (
        <div className="admin-modal-backdrop">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={grantModalTitleId}
          >
            <h3 id={grantModalTitleId}>Выдать пакет</h3>
            <FormSelect
              label="Пакет"
              id="admin-grant-package"
              value={grantPackageId}
              onChange={(e) => setGrantPackageId(e.target.value)}
            >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} ({pkg.code}) — {pkg.themeIds.join(', ')}
                  </option>
                ))}
            </FormSelect>
            <FormTextarea
              label="Примечание (опционально)"
              id="admin-grant-note"
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              rows={4}
            />
            {grantError && <ErrorMessage message={grantError} />}
            <div className="admin-modal__actions">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  setGrantOpen(false);
                  setGrantError(null);
                  grantOpenButtonRef.current?.focus();
                }}
              >
                Отмена
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={granting || !grantPackageId}
                onClick={async () => {
                  setGranting(true);
                  setGrantError(null);
                  try {
                    await adminApiService.grantEntitlement(id, {
                      packageId: grantPackageId,
                      note: grantNote.trim() || undefined,
                    });
                    setGrantOpen(false);
                    setGrantNote('');
                    grantOpenButtonRef.current?.focus();
                    await load();
                  } catch (err) {
                    setGrantError(extractApiErrorMessage(err, 'Ошибка выдачи пакета'));
                  } finally {
                    setGranting(false);
                  }
                }}
              >
                {granting ? 'Выдача…' : 'Выдать'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {revokeEntitlement && (
        <div className="admin-modal-backdrop">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={revokeModalTitleId}
          >
            <h3 id={revokeModalTitleId}>Отозвать пакет</h3>
            <p>
              {revokeEntitlement.packageName} ({revokeEntitlement.packageCode})
            </p>
            <FormTextarea
                label="Примечание (опционально)"
                id="admin-revoke-note"
                value={revokeNote}
                onChange={(e) => {
                  setRevokeNote(e.target.value);
                  setRevokeError(null);
                  if (!revocationPending) setRevocationRequestId(crypto.randomUUID());
                }}
                rows={4}
                disabled={revocationPending}
              />
            {revokeError && <ErrorMessage message={revokeError} />}
            <div className="admin-modal__actions">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  setRevokeEntitlement(null);
                  setRevokeError(null);
                  setRevocationRequestId(null);
                  setRevocationPending(false);
                  revokeOpenButtonRef.current?.focus();
                }}
                disabled={revoking}
              >
                Отмена
              </Button>
              <Button
                variant="danger"
                size="sm"
                type="button"
                disabled={revoking}
                onClick={async () => {
                  setRevoking(true);
                  setRevokeError(null);
                  const savedRequest = readPendingRevocation(revokeEntitlement.id);
                  const request =
                    savedRequest ??
                    {
                      id: revocationRequestId ?? crypto.randomUUID(),
                      entitlementId: revokeEntitlement.id,
                      note: revokeNote.trim() || undefined,
                    };
                  try {
                    const persisted = persistPendingRevocation(request);
                    setRevokePersistenceWarning(
                      persisted
                        ? null
                        : 'Браузер не сохранил запрос отзыва. Повторить его можно в этом окне; после перезагрузки восстановление запроса не гарантируется.',
                    );
                    setRevocationRequestId(request.id);
                    setRevokeNote(request.note ?? '');
                    setRevocationPending(true);
                    await adminApiService.revokeEntitlement(request);
                    clearPendingRevocation(revokeEntitlement.id);
                    setRevokeEntitlement(null);
                    setRevokeNote('');
                    setRevocationRequestId(null);
                    setRevocationPending(false);
                    revokeOpenButtonRef.current?.focus();
                    await load();
                  } catch (err) {
                    setRevokeError(extractApiErrorMessage(err, 'Ошибка отзыва'));
                    if (isDefinitiveRevocationRejection(err)) {
                      clearPendingRevocation(revokeEntitlement.id);
                      setRevocationRequestId(crypto.randomUUID());
                      setRevocationPending(false);
                    }
                  } finally {
                    setRevoking(false);
                  }
                }}
              >
                {revoking ? 'Отзыв…' : revocationPending ? 'Повторить отзыв' : 'Отозвать'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
