import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { useSiteAuth } from '../contexts/SiteAuthContext';
import './SiteHeader.css';

export const SiteHeader = () => {
  const { organizer, checked: authChecked } = useSiteAuth();

  return (
    <header className="site-header">
      <div className="site-header-content">
        <Link
          className="site-header-brand"
          to={ROUTES.HOME}
          aria-label="CherryPashkaParty — вечеринки"
        >
          <img src="/icon-192.png" alt="" aria-hidden="true" />
          CherryPashkaParty
        </Link>
        <nav className="site-header-nav" aria-label="Основная навигация">
          <Link to={ROUTES.HOME}>Вечеринки</Link>
          <Link to={ROUTES.DOWNLOAD}>Скачать приложение</Link>
          <Link to={ROUTES.FIRST_RUN_GUIDE}>Первый запуск</Link>
          <Link to={ROUTES.FEEDBACK}>Обратная связь</Link>
          {authChecked && (
            <Link to={organizer ? ROUTES.CABINET : ROUTES.LOGIN}>
              {organizer ? 'Кабинет' : 'Вход'}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
