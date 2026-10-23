import { NavLink } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';

export const AdminSectionNav = () => (
  <nav className="admin-section-nav" aria-label="Разделы админки">
    <NavLink to={ROUTES.ADMIN_ORGANIZERS}>Организаторы</NavLink>
    <NavLink to={ROUTES.ADMIN_PARTIES}>Вечеринки</NavLink>
  </nav>
);
