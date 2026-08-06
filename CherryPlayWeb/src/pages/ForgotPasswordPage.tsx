import { ForgotPasswordForm } from '@cherryplay/components';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { authService } from '../services/authService';
import './LoginPage.css';

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <div className="login-page-form">
        <ForgotPasswordForm
          authService={authService}
          onBackToLogin={() => navigate(ROUTES.LOGIN)}
        />
      </div>
    </div>
  );
}
