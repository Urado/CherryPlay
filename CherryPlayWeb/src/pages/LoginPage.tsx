import { AuthForm } from '@cherryplay/components';
import { useNavigate, Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { useAppConfig } from '../contexts/AppConfigContext';
import { authService } from '../services/authService';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { oauthEnabled } = useAppConfig();

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
