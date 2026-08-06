import { ResetPasswordForm } from '@cherryplay/components';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { authService } from '../services/authService';
import './LoginPage.css';

const REDIRECT_TO_LOGIN_MS = 4000;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const redirectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleSuccess = () => {
    if (redirectTimeoutRef.current !== null) {
      window.clearTimeout(redirectTimeoutRef.current);
    }
    redirectTimeoutRef.current = window.setTimeout(() => {
      navigate(ROUTES.LOGIN, { replace: true });
    }, REDIRECT_TO_LOGIN_MS);
  };

  return (
    <div className="login-page">
      <div className="login-page-form">
        <ResetPasswordForm
          token={token}
          authService={authService}
          onSuccess={handleSuccess}
          onBackToLogin={() => navigate(ROUTES.LOGIN)}
        />
      </div>
    </div>
  );
}
