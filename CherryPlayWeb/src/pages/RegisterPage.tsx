import { EmailAuthForm } from '@cherryplay/components';
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { SiteFooter } from '../components/SiteFooter';
import { ROUTES } from '../constants/routes';
import { authService } from '../services/authService';
import { isDesktopClientQueryValue } from '../utils/desktopClientMode';
import './RegisterPage.css';

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const desktopMode = isDesktopClientQueryValue(searchParams.get('client'));

  useEffect(() => {
    if (!desktopMode) {
      return;
    }

    const params = new URLSearchParams();
    const next = searchParams.get('next');
    if (next) {
      params.set('next', next);
    }
    params.set('client', 'desktop');
    const returnTo = searchParams.get('return_to');
    if (returnTo) {
      params.set('return_to', returnTo);
    }
    const query = params.toString();
    navigate(`${ROUTES.LOGIN}${query ? `?${query}` : ''}`, { replace: true });
  }, [desktopMode, navigate, searchParams]);

  if (desktopMode) {
    return null;
  }

  const handleRegisterSuccess = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const organizer = await authService.checkAuth?.();
    if (organizer) {
      navigate(ROUTES.CABINET);
    }
  };

  return (
    <div className="register-page">
      <div className="register-page-body">
        <div className="register-container">
          <h1>Регистрация</h1>
          <p className="register-subtitle">Создайте аккаунт организатора</p>
          <EmailAuthForm
            mode="register"
            authService={authService}
            onSuccess={() => {
              void handleRegisterSuccess();
            }}
            showModeToggle={false}
          />
          <div className="login-link">
            Уже есть аккаунт? <Link to={ROUTES.LOGIN}>Войти</Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
