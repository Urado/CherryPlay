import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import './CookieNotice.css';

const STORAGE_KEY = 'cherryplay.cookie-notice.dismissed';
const BODY_CLASS = 'has-cookie-notice';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function CookieNotice() {
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    document.body.classList.toggle(BODY_CLASS, !dismissed);
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, [dismissed]);

  if (dismissed) {
    return null;
  }

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true);
  };

  return (
    <div className="cookie-notice" role="region" aria-label="Уведомление о cookie">
      <p className="cookie-notice-text">
        Используем необходимые cookie для входа.{' '}
        <Link to={ROUTES.COOKIES}>Политика cookie</Link>
      </p>
      <button type="button" className="cookie-notice-dismiss" onClick={dismiss}>
        Понятно
      </button>
    </div>
  );
}
