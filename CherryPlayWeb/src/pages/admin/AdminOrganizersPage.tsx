import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useRequireAdmin } from '../../hooks/useRequireAdmin';
import { adminApiService } from '../../services/adminApiService';
import type { AdminOrganizerListItemDto } from '../../types/api';

import './AdminPages.css';

const PAGE_SIZE = 20;

function getOrganizerContactLabel(item: AdminOrganizerListItemDto): string {
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
}

export function AdminOrganizersPage() {
  const navigate = useNavigate();
  const { checking, isAdmin } = useRequireAdmin();
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminOrganizerListItemDto[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPage(1);
      setQuery(queryInput.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [queryInput]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await adminApiService.getOrganizers({ query, page, pageSize: PAGE_SIZE });
        setItems(result.items);
        setTotal(result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить список организаторов');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [isAdmin, page, query]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  if (checking || !isAdmin) {
    return <div className="admin-page admin-page--loading">Проверка доступа…</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1>Админка: организаторы</h1>
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="Поиск по имени или email"
          aria-label="Поиск организаторов"
        />
      </div>

      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

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
                <tr
                  key={item.id}
                  onClick={() => navigate(ROUTES.ADMIN_ORGANIZER_DETAIL(item.id))}
                  className="admin-table__row-clickable"
                >
                  <td>{item.name}</td>
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

      <div className="admin-pagination">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          aria-label="Предыдущая страница"
        >
          ←
        </button>
        <span>
          Страница {page} из {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
          aria-label="Следующая страница"
        >
          →
        </button>
      </div>
    </div>
  );
}
