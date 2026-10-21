import { useRequireAdmin } from '../../hooks/useRequireAdmin';

import { AdminPartiesList } from './AdminPartiesList';
import { AdminSectionNav } from './AdminSectionNav';
import './AdminPages.css';

export const AdminPartiesPage = () => {
  const { checking, isAdmin } = useRequireAdmin();

  if (checking || !isAdmin) {
    return <div className="admin-page admin-page--loading">Проверка доступа…</div>;
  }

  return (
    <main className="admin-page admin-page--wide">
      <div className="admin-page__header">
        <h1>Админка: вечеринки</h1>
      </div>
      <AdminSectionNav />
      <AdminPartiesList />
    </main>
  );
};
