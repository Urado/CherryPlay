import { EmailAuthForm } from '@cherryplay/components';
import { useNavigate, Link } from 'react-router-dom';

import { authService } from '../services/authService';
import './RegisterPage.css';

export function RegisterPage() {
  const navigate = useNavigate();

  const handleRegisterSuccess = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const organizer = await authService.checkAuth?.();
    if (organizer) {
      navigate('/cabinet');
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <h1>Регистрация</h1>
        <p className="register-subtitle">Создайте аккаунт организатора</p>
        <EmailAuthForm
          mode="register"
          authService={authService}
          onSuccess={handleRegisterSuccess}
          showModeToggle={false}
        />
        <div className="login-link">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </div>
    </div>
  );
}
