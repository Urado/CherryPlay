import { Button } from '@cherryplay/components';
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

export const CookieNotice = () => {
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
      setDismissed(true);
    }
    setDismissed(true);
  };

  return (
    <div
      className="cookie-notice"
      data-shell-theme="dark"
      role="region"
      aria-label="Уведомление о cookie"
    >
      <p className="cookie-notice-text">
        Используем необходимые cookie для входа. <Link to={ROUTES.COOKIES}>Политика cookie</Link>
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="cookie-notice-dismiss"
        onClick={dismiss}
      >
        Понятно
      </Button>
    </div>
  );
};
