import { AuthForm } from '@cherryplay/components';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import { ROUTES } from '../constants/routes';
import { authService } from '../services/authService';
import './LoginPage.css';

interface AppConfig {
  oauthEnabled: boolean;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [oauthEnabled, setOauthEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(getApiUrl(API_ENDPOINTS.CONFIG), { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AppConfig | null) => {
        if (!cancelled && data && typeof data.oauthEnabled === 'boolean') {
          setOauthEnabled(data.oauthEnabled);
        }
      })
      .catch((err) => {
        // При ошибке запроса конфига оставляем OAuth выключенным (значение по умолчанию).
        if (import.meta.env.DEV) {
          console.warn(
            '[LoginPage] Failed to fetch app config, using default oauthEnabled=true',
            err,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoginSuccess = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const organizer = await authService.checkAuth?.();
    if (organizer) {
      navigate(ROUTES.CABINET);
    }
  };

  return (
    <div className="login-page">
      <AuthForm
        title="Вход в систему"
        description="Войдите, чтобы управлять вечеринками"
        authService={authService}
        oauthEnabled={oauthEnabled}
        onLoginSuccess={handleLoginSuccess}
        className="login-page-form"
      />
      <div className="register-link">
        Нет аккаунта? <Link to={ROUTES.REGISTER}>Зарегистрироваться</Link>
      </div>
    </div>
  );
}
