import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import './SiteFooter.css';

export const SiteFooter = () => {
  return (
    <footer className="site-footer" role="contentinfo">
      <nav className="site-footer-nav" aria-label="Юридические документы">
        <Link to={ROUTES.PRIVACY}>Политика персональных данных</Link>
        <Link to={ROUTES.CONSENT}>Согласие на обработку персональных данных</Link>
        <Link to={ROUTES.TERMS}>Пользовательское соглашение</Link>
        <Link to={ROUTES.COOKIES}>Политика cookie</Link>
        <Link to={ROUTES.LEGAL}>Реквизиты</Link>
      </nav>
    </footer>
  );
};
