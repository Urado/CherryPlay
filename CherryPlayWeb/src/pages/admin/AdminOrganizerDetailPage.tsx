import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useRequireAdmin } from '../../hooks/useRequireAdmin';
import { adminApiService } from '../../services/adminApiService';
import type { AdminOrganizerDetailDto, EntitlementDto, ThemePackageDto } from '../../types/api';
import { extractApiErrorMessage } from '../../utils/apiErrorHandler';

import './AdminPages.css';

function isActiveEntitlement(entitlement: EntitlementDto): boolean {
  if (entitlement.revokedAt) return false;
  if (!entitlement.expiresAt) return true;
  return new Date(entitlement.expiresAt).getTime() > Date.now();
}

export function AdminOrganizerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { checking, isAdmin } = useRequireAdmin();
  const loadRequestIdRef = useRef(0);
  const [organizer, setOrganizer] = useState<AdminOrganizerDetailDto | null>(null);
  const [packages, setPackages] = useState<ThemePackageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantPackageId, setGrantPackageId] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);

  const [revokeEntitlement, setRevokeEntitlement] = useState<EntitlementDto | null>(null);
  const [revokeNote, setRevokeNote] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const grantOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const revokeOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const grantModalTitleId = 'admin-grant-modal-title';
  const revokeModalTitleId = 'admin-revoke-modal-title';

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
    try {
      const [organizerData, packageData] = await Promise.all([
        adminApiService.getOrganizerById(id),
        adminApiService.getThemePackages(),
      ]);
      if (requestId !== loadRequestIdRef.current) return;
      setOrganizer(organizerData);
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
  }, [id]);

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
    () => (organizer?.entitlements ?? []).filter((e) => !isActiveEntitlement(e)),
    [organizer?.entitlements],
  );

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

      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p>Загрузка…</p>
      ) : error ? (
        <section className="admin-card" aria-live="polite">
          <p>Не удалось загрузить карточку организатора.</p>
          <div className="admin-modal__actions admin-modal__actions--start">
            <button type="button" onClick={() => void load()}>
              Повторить
            </button>
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
              <button ref={grantOpenButtonRef} type="button" onClick={() => setGrantOpen(true)}>
                Выдать пакет
              </button>
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
                    <button
                      type="button"
                      onClick={() => {
                        revokeOpenButtonRef.current =
                          document.activeElement as HTMLButtonElement | null;
                        setRevokeEntitlement(entitlement);
                        setRevokeNote('');
                        setRevokeError(null);
                      }}
                    >
                      Отозвать
                    </button>
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
                          : ''}
                      </div>
                    </div>
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
            <label>
              Пакет
              <select value={grantPackageId} onChange={(e) => setGrantPackageId(e.target.value)}>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} ({pkg.code}) — {pkg.themeIds.join(', ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note (опционально)
              <textarea value={grantNote} onChange={(e) => setGrantNote(e.target.value)} rows={4} />
            </label>
            {grantError && (
              <div className="admin-error" role="alert">
                {grantError}
              </div>
            )}
            <div className="admin-modal__actions">
              <button
                type="button"
                onClick={() => {
                  setGrantOpen(false);
                  setGrantError(null);
                  grantOpenButtonRef.current?.focus();
                }}
              >
                Отмена
              </button>
              <button
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
              </button>
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
            <label>
              Note (опционально)
              <textarea
                value={revokeNote}
                onChange={(e) => setRevokeNote(e.target.value)}
                rows={4}
              />
            </label>
            {revokeError && (
              <div className="admin-error" role="alert">
                {revokeError}
              </div>
            )}
            <div className="admin-modal__actions">
              <button
                type="button"
                onClick={() => {
                  setRevokeEntitlement(null);
                  setRevokeError(null);
                  revokeOpenButtonRef.current?.focus();
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={async () => {
                  setRevoking(true);
                  setRevokeError(null);
                  try {
                    await adminApiService.revokeEntitlement(id, revokeEntitlement.id, {
                      note: revokeNote.trim() || undefined,
                    });
                    setRevokeEntitlement(null);
                    setRevokeNote('');
                    revokeOpenButtonRef.current?.focus();
                    await load();
                  } catch (err) {
                    setRevokeError(extractApiErrorMessage(err, 'Ошибка отзыва'));
                  } finally {
                    setRevoking(false);
                  }
                }}
              >
                {revoking ? 'Отзыв…' : 'Отозвать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
