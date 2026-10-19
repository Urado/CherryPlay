import { AdaptiveSearchInput, ErrorMessage } from '@cherryplay/components';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useRequireAdmin } from '../../hooks/useRequireAdmin';
import { adminApiService } from '../../services/adminApiService';
import type { AdminOrganizerListItemDto } from '../../types/api';
import { extractApiErrorMessage } from '../../utils/apiErrorHandler';

import { AdminPagination } from './AdminPagination';
import { AdminSectionNav } from './AdminSectionNav';

import './AdminPages.css';

const PAGE_SIZE = 20;

const getOrganizerContactLabel = (item: AdminOrganizerListItemDto): string => {
  if (item.email) {
    return item.email;
  }

  const firstOAuth = item.oauthAccounts?.[0];
  if (firstOAuth) {
    const providerLabel = firstOAuth.provider;
    const providerUserName = firstOAuth.providerUserName?.trim();
    const providerUserId = firstOAuth.providerUserId?.trim();
    return providerUserName
      ? `OAuth: ${providerLabel} · ${providerUserName}`
      : providerUserId
        ? `OAuth: ${providerLabel} · ${providerUserId}`
        : `OAuth: ${providerLabel}`;
  }

  if (item.oauthProviders?.length) {
    return `OAuth: ${item.oauthProviders[0]}`;
  }

  return 'Нет контакта';
};

export const AdminOrganizersPage = () => {
  const { checking, isAdmin } = useRequireAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('query') ?? '';
  const pageValue = Number(searchParams.get('page'));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminOrganizerListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isAdmin) return;
    const requestId = ++requestIdRef.current;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await adminApiService.getOrganizers({ query, page, pageSize: PAGE_SIZE });
        if (requestId !== requestIdRef.current) return;
        const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
        if (page > lastPage) {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (lastPage > 1) next.set('page', String(lastPage));
            else next.delete('page');
            return next;
          }, { replace: true });
          return;
        }
        setItems(result.items);
        setTotal(result.total);
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(extractApiErrorMessage(err, 'Не удалось загрузить список организаторов'));
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    };
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [isAdmin, page, query, setSearchParams]);

  if (checking || !isAdmin) {
    return <div className="admin-page admin-page--loading">Проверка доступа…</div>;
  }

  return (
    <div className="admin-page admin-page--wide">
      <div className="admin-page__header">
        <h1>Админка: организаторы</h1>
      </div>

      <AdminSectionNav />

      <div className="admin-toolbar">
        <AdaptiveSearchInput
          label="Поиск организаторов"
          id="admin-organizer-search"
          type="search"
          value={query}
          onValueChange={(value) => {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              if (value) next.set('query', value);
              else next.delete('query');
              next.delete('page');
              return next;
            }, { replace: true });
          }}
          placeholder="Поиск по имени или email"
        />
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Контакт</th>
                <th>Роль</th>
                <th>Активные доступы</th>
                <th>Дата регистрации</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="admin-table__row-navigable">
                  <td>
                    <Link
                      to={ROUTES.ADMIN_ORGANIZER_DETAIL(item.id)}
                      className="admin-table__row-link"
                      aria-label={`Открыть карточку организатора ${item.name}`}
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td>{getOrganizerContactLabel(item)}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${item.role}`}>
                      {item.role === 'admin' ? 'admin' : 'organizer'}
                    </span>
                  </td>
                  <td>{item.activeEntitlementsCount}</td>
                  <td>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <p>Ничего не найдено.</p>}
        </div>
      )}

      <AdminPagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        disabled={loading}
        onPageChange={(nextPage) => {
          const next = new URLSearchParams(searchParams);
          if (nextPage > 1) next.set('page', String(nextPage));
          else next.delete('page');
          setSearchParams(next, { replace: true });
        }}
      />
    </div>
  );
};
