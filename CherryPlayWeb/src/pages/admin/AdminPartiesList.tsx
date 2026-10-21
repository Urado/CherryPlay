import { AdaptiveSearchInput, Button, ErrorMessage, FormSelect } from '@cherryplay/components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { adminApiService } from '../../services/adminApiService';
import type {
  AdminOrganizerListItemDto,
  AdminPartyListItemDto,
  PartyLifecycleState,
} from '../../types/api';
import { extractApiErrorMessage } from '../../utils/apiErrorHandler';

import { AdminPagination } from './AdminPagination';

const PAGE_SIZE = 20;
const lifecycleLabels: Record<PartyLifecycleState, string> = {
  draft: 'Черновик',
  ready: 'Готова',
  completed: 'Завершена',
};

interface AdminPartiesListProps {
  fixedOrganizerId?: string;
  showFilters?: boolean;
}

const readPage = (value: string | null): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const readBoolean = (value: string | null): boolean | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return 'Не указана';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Не указана' : date.toLocaleString('ru-RU');
};

const organizerLabel = (
  organizer: Pick<AdminOrganizerListItemDto, 'name' | 'email' | 'oauthAccounts'>,
): string => {
  const contact = organizer.email ?? organizer.oauthAccounts?.[0]?.providerUserName;
  return contact ? `${organizer.name} · ${contact}` : organizer.name;
};

export const AdminPartiesList = ({
  fixedOrganizerId,
  showFilters = true,
}: AdminPartiesListProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const latestParamsRef = useRef(new URLSearchParams(searchParams));
  const lastWrittenSearchRef = useRef(searchParams.toString());
  const [items, setItems] = useState<AdminPartyListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [organizerSearch, setOrganizerSearch] = useState('');
  const [selectedOrganizer, setSelectedOrganizer] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [organizerOptions, setOrganizerOptions] = useState<AdminOrganizerListItemDto[]>([]);
  const [organizerSearchError, setOrganizerSearchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const organizerSearchIdRef = useRef(0);

  const organizerId = fixedOrganizerId ?? searchParams.get('organizerId') ?? undefined;
  const query = searchParams.get('query') ?? '';
  const city = searchParams.get('city') ?? '';
  const lifecycleParam = searchParams.get('partyLifecycleState');
  const lifecycle = ['draft', 'ready', 'completed'].includes(lifecycleParam ?? '')
    ? (lifecycleParam as PartyLifecycleState)
    : undefined;
  const catalogParam = searchParams.get('isListedInCatalog');
  const deletedParam = searchParams.get('isDeleted');
  const isListedInCatalog = readBoolean(catalogParam);
  const isDeleted = readBoolean(deletedParam);
  const page = readPage(searchParams.get('page'));

  useEffect(() => {
    const currentSearch = searchParams.toString();
    if (currentSearch === lastWrittenSearchRef.current) return;
    latestParamsRef.current = new URLSearchParams(searchParams);
    lastWrittenSearchRef.current = currentSearch;
  }, [searchParams]);

  const filters = useMemo(
    () => ({
      ...(organizerId ? { organizerId } : {}),
      ...(query ? { query } : {}),
      ...(city ? { city } : {}),
      ...(lifecycle ? { partyLifecycleState: lifecycle } : {}),
      ...(isListedInCatalog !== undefined ? { isListedInCatalog } : {}),
      ...(isDeleted !== undefined ? { isDeleted } : {}),
      page,
      pageSize: PAGE_SIZE,
    }),
    [city, isDeleted, isListedInCatalog, lifecycle, organizerId, page, query],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const next = new URLSearchParams(latestParamsRef.current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      if (resetPage) next.delete('page');
      latestParamsRef.current = next;
      lastWrittenSearchRef.current = next.toString();
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    void adminApiService
      .getParties(filters)
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setItems(response.items);
        setTotal(response.total);
        const lastPage = Math.max(1, Math.ceil(response.total / PAGE_SIZE));
        if (page > lastPage) {
          updateParams({ page: lastPage > 1 ? String(lastPage) : undefined }, false);
        }
      })
      .catch((err: unknown) => {
        if (requestId === requestIdRef.current) {
          setError(extractApiErrorMessage(err, 'Не удалось загрузить вечеринки'));
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
    return () => {
      requestIdRef.current += 1;
    };
  }, [filters, page, retryCount, updateParams]);

  useEffect(() => {
    const normalizedSearch = organizerSearch.trim();
    if (normalizedSearch.length < 1) {
      setOrganizerOptions([]);
      setOrganizerSearchError(null);
      return;
    }
    const requestId = ++organizerSearchIdRef.current;
    void adminApiService
      .getOrganizers({ query: normalizedSearch, page: 1, pageSize: 20 })
      .then((response) => {
        if (organizerSearchIdRef.current === requestId) setOrganizerOptions(response.items);
      })
      .catch((err: unknown) => {
        if (organizerSearchIdRef.current === requestId) {
          setOrganizerSearchError(extractApiErrorMessage(err, 'Не удалось найти организатора'));
        }
      });
    return () => {
      organizerSearchIdRef.current += 1;
    };
  }, [organizerSearch]);

  useEffect(() => {
    if (!organizerId || selectedOrganizer?.id === organizerId) return;
    let active = true;
    void adminApiService
      .getOrganizerById(organizerId)
      .then((organizer) => {
        if (active) setSelectedOrganizer({ id: organizer.id, label: organizerLabel(organizer) });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [organizerId, selectedOrganizer]);

  const selectedOrganizerLabel = useMemo(() => {
    if (!organizerId) return '';
    if (selectedOrganizer?.id === organizerId) return selectedOrganizer.label;
    const option = organizerOptions.find((item) => item.id === organizerId);
    if (option) return organizerLabel(option);
    const listedParty = items.find((item) => item.organizerId === organizerId);
    if (listedParty) {
      return listedParty.isOrganizerDeleted
        ? `Удалённый организатор · ${listedParty.organizerId}`
        : listedParty.organizerName;
    }
    return `Организатор · ${organizerId}`;
  }, [items, organizerId, organizerOptions, selectedOrganizer]);

  const selectOrganizer = (organizer: AdminOrganizerListItemDto) => {
    setSelectedOrganizer({ id: organizer.id, label: organizerLabel(organizer) });
    setOrganizerSearch('');
    setOrganizerOptions([]);
    updateParams({ organizerId: organizer.id });
  };

  return (
    <>
      {showFilters && (
        <div className="admin-party-filters">
          <div className="admin-party-organizer-filter">
            {organizerId && (
              <div className="admin-party-selected-field form-group">
                <label className="form-label" htmlFor="admin-party-organizer-filter">
                  Организатор
                </label>
                <div className="admin-party-selected-filter">
                  <span>{selectedOrganizerLabel}</span>
                  <button
                    className="admin-party-filter-clear"
                    type="button"
                    onClick={() => {
                      setSelectedOrganizer(null);
                      setOrganizerSearch('');
                      updateParams({ organizerId: undefined });
                    }}
                    aria-label="Сбросить фильтр организатора"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
            {!organizerId && (
              <AdaptiveSearchInput
                label="Организатор"
                id="admin-party-organizer-filter"
                value={organizerSearch}
                onValueChange={(value) => {
                  setOrganizerSearchError(null);
                  setOrganizerSearch(value);
                }}
                placeholder="Введите имя или контакт"
                role="combobox"
                autoComplete="off"
                aria-expanded={organizerOptions.length > 0}
                aria-controls="admin-party-organizer-options"
              />
            )}
            {organizerSearchError && <ErrorMessage message={organizerSearchError} />}
            {organizerOptions.length > 0 && (
              <ul
                id="admin-party-organizer-options"
                className="admin-party-organizer-options"
                role="listbox"
              >
                {organizerOptions.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.id === organizerId}
                      onClick={() => selectOrganizer(option)}
                    >
                      {organizerLabel(option)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AdaptiveSearchInput
            label="Название вечеринки"
            id="admin-party-query-filter"
            value={query}
            onValueChange={(value) => updateParams({ query: value || undefined })}
            placeholder="Поиск по названию"
          />
          <AdaptiveSearchInput
            label="Город"
            id="admin-party-city-filter"
            value={city}
            onValueChange={(value) => updateParams({ city: value || undefined })}
            placeholder="Поиск по городу"
          />
          <FormSelect
            label="Статус"
            id="admin-party-lifecycle-filter"
            value={lifecycle ?? ''}
            onChange={(event) =>
              updateParams({ partyLifecycleState: event.target.value || undefined })
            }
          >
            <option value="">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="ready">Готова</option>
            <option value="completed">Завершена</option>
          </FormSelect>
          <FormSelect
            label="Видимость в каталоге"
            id="admin-party-catalog-filter"
            value={catalogParam ?? ''}
            onChange={(event) =>
              updateParams({ isListedInCatalog: event.target.value || undefined })
            }
          >
            <option value="">Любая видимость</option>
            <option value="true">В каталоге</option>
            <option value="false">Скрыта из каталога</option>
          </FormSelect>
          <FormSelect
            label="Удаление"
            id="admin-party-deleted-filter"
            value={deletedParam ?? ''}
            onChange={(event) => updateParams({ isDeleted: event.target.value || undefined })}
          >
            <option value="">Все записи</option>
            <option value="false">Не удалена</option>
            <option value="true">Удалена</option>
          </FormSelect>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      <div className="admin-table-wrap" aria-busy={loading}>
        {loading && items.length > 0 && (
          <span className="admin-table-loading" role="status">
            Обновление…
          </span>
        )}
        <table className="admin-table admin-party-table">
          <thead>
            <tr>
              <th>Вечеринка</th>
              <th>Организатор</th>
              <th>Город</th>
              <th>Дата</th>
              <th>Статус</th>
              <th>Каталог</th>
            </tr>
          </thead>
          <tbody>
            {items.map((party) => (
              <tr key={party.id} className="admin-party-row">
                <td>
                  <Link
                    to={ROUTES.ADMIN_PARTY_DETAIL(party.id)}
                    className="admin-party-row-link"
                    aria-label={`Открыть вечеринку ${party.title?.trim() || party.name}`}
                  >
                    <strong>{party.title?.trim() || party.name}</strong>
                  </Link>
                  <div className="admin-party-meta" aria-hidden="true">
                    {party.shortCode}
                    {party.isDeleted && <span className="admin-badge">Удалена</span>}
                  </div>
                </td>
                <td>
                  {party.isOrganizerDeleted ? (
                    <Link
                      to={`${ROUTES.ADMIN_PARTIES}?organizerId=${encodeURIComponent(party.organizerId)}`}
                      className="admin-link"
                    >
                      Организатор удален
                    </Link>
                  ) : (
                    <Link
                      to={ROUTES.ADMIN_ORGANIZER_DETAIL(party.organizerId)}
                      className="admin-link"
                    >
                      {party.organizerName}
                    </Link>
                  )}
                  {(party.hasActiveSession || party.isOrganizerConnected) && (
                    <div className="admin-party-meta">
                      {party.hasActiveSession ? 'Сессия активна' : 'Сессия не активна'}
                      {' · '}
                      {party.isOrganizerConnected ? 'Десктоп подключён' : 'Десктоп отключён'}
                    </div>
                  )}
                </td>
                <td>{party.city || 'Не указан'}</td>
                <td>{formatDate(party.eventDateTime)}</td>
                <td>
                  <span className={`admin-badge admin-badge--party-${party.partyLifecycleState}`}>
                    {lifecycleLabels[party.partyLifecycleState]}
                  </span>
                </td>
                <td>{party.isListedInCatalog ? 'В каталоге' : 'Скрыта из каталога'}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-table__empty-state">
                  {loading ? (
                    <span role="status">Загрузка вечеринок…</span>
                  ) : error ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => setRetryCount((current) => current + 1)}
                    >
                      Повторить загрузку
                    </Button>
                  ) : (
                    'Вечеринки не найдены.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        disabled={loading}
        onPageChange={(nextPage) => updateParams({ page: String(nextPage) }, false)}
      />
    </>
  );
};
