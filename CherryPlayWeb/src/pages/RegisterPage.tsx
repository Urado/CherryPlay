import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '../constants/routes';

/**
 * Отдельная страница регистрации перенаправляет на страницу входа
 * с переключателем «Вход / Регистрация» сверху.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const next = searchParams.get('next')
      ? `?next=${encodeURIComponent(searchParams.get('next')!)}`
      : '';
    navigate(`${ROUTES.LOGIN}${next}`, { replace: true });
  }, [navigate, searchParams]);

  return null;
}
