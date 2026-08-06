import { AuthForm } from '@cherryplay/components';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { useAppConfig } from '../contexts/AppConfigContext';
import { authService } from '../services/authService';
import './LoginPage.css';

type LoginLocationState = { passwordChanged?: boolean } | null;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { oauthEnabled } = useAppConfig();
  const [passwordChangedNotice] = useState(
    () => (location.state as LoginLocationState)?.passwordChanged === true,
  );

  useEffect(() => {
    if (!passwordChangedNotice) return;
    if (!(location.state as LoginLocationState)?.passwordChanged) return;
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.state, navigate, passwordChangedNotice]);

  const handleLoginSuccess = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const organizer = await authService.checkAuth?.();
    if (organizer) {
      navigate(ROUTES.CABINET);
    }
  };

  return (
    <div className="login-page">
      {passwordChangedNotice && (
        <div className="login-page-notice" role="status" aria-live="polite">
          Пароль успешно изменён. Войдите снова с новым паролем.
        </div>
      )}
      <AuthForm
        title="Вход в систему"
        description="Войдите, чтобы управлять вечеринками"
        authService={authService}
        oauthEnabled={oauthEnabled}
        onLoginSuccess={handleLoginSuccess}
        onForgotPassword={() => navigate(ROUTES.FORGOT_PASSWORD)}
        className="login-page-form"
      />
      <div className="register-link">
        Нет аккаунта? <Link to={ROUTES.REGISTER}>Зарегистрироваться</Link>
      </div>
    </div>
  );
}
