import React, { useState } from 'react';

import {
  validateEmail,
  validateOrganizerName,
  MIN_PASSWORD_LENGTH,
  MAX_ORGANIZER_NAME_LENGTH,
} from '../../core/utils/authValidation';
import type { AuthService } from '../../types/auth';
import { FormInput, FormButton, ErrorMessage } from '../UI';
import './EmailAuthForm.css';

export interface EmailAuthFormProps {
  mode: 'login' | 'register';
  authService: AuthService;
  loading?: boolean;
  error?: string | null;
  onModeChange?: (mode: 'login' | 'register') => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  showModeToggle?: boolean;
}

export const EmailAuthForm: React.FC<EmailAuthFormProps> = ({
  mode,
  authService,
  loading: externalLoading,
  error: externalError,
  onModeChange,
  onSuccess,
  onError,
  showModeToggle = true,
}) => {
  const [emailMode, setEmailMode] = useState<'login' | 'register'>(mode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleModeChange = (newMode: 'login' | 'register') => {
    setEmailMode(newMode);
    setError(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    onModeChange?.(newMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      const err = 'Некорректный формат email';
      setError(err);
      onError?.(err);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      const err = `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`;
      setError(err);
      onError?.(err);
      return;
    }

    setLoading(true);

    try {
      await authService.login(email, password);
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при входе';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateOrganizerName(name)) {
      const err = `Название организации обязательно и не должно превышать ${MAX_ORGANIZER_NAME_LENGTH} символов`;
      setError(err);
      onError?.(err);
      return;
    }

    if (!validateEmail(email)) {
      const err = 'Некорректный формат email';
      setError(err);
      onError?.(err);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      const err = `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`;
      setError(err);
      onError?.(err);
      return;
    }

    if (password !== confirmPassword) {
      const err = 'Пароли не совпадают';
      setError(err);
      onError?.(err);
      return;
    }

    setLoading(true);

    try {
      await authService.register(email, password, name.trim());
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при регистрации';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isLoading = externalLoading || loading;
  const displayError = externalError || error;

  return (
    <div className="email-auth-form">
      {showModeToggle && (
        <div className="email-auth-form-tabs">
          <button
            type="button"
            className={`email-auth-form-tab ${emailMode === 'login' ? 'email-auth-form-tab--active' : ''}`}
            onClick={() => handleModeChange('login')}
          >
            Вход
          </button>
          <button
            type="button"
            className={`email-auth-form-tab ${emailMode === 'register' ? 'email-auth-form-tab--active' : ''}`}
            onClick={() => handleModeChange('register')}
          >
            Регистрация
          </button>
        </div>
      )}

      {displayError && <ErrorMessage message={displayError} />}

      {emailMode === 'login' ? (
        <form onSubmit={handleLogin} className="email-auth-form-content">
          <FormInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={isLoading}
            autoComplete="email"
          />

          <FormInput
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
            autoComplete="current-password"
            minLength={MIN_PASSWORD_LENGTH}
          />

          <FormButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={!email || !password}
          >
            Войти
          </FormButton>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="email-auth-form-content">
          <FormInput
            label="Название организации"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название вашей организации"
            required
            disabled={isLoading}
            autoComplete="organization"
            maxLength={MAX_ORGANIZER_NAME_LENGTH}
          />

          <FormInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={isLoading}
            autoComplete="email"
          />

          <FormInput
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            hint={`Минимум ${MIN_PASSWORD_LENGTH} символов`}
          />

          <FormInput
            label="Подтвердите пароль"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />

          <FormButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={!name || !email || !password || !confirmPassword}
          >
            Зарегистрироваться
          </FormButton>
        </form>
      )}
    </div>
  );
};
