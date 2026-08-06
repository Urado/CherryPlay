import React, { useState } from 'react';

import {
  validatePassword,
  validatePasswordMatch,
  MIN_PASSWORD_LENGTH,
  RESET_PASSWORD_INVALID_TOKEN,
} from '../../core/utils/authValidation';
import type { ResetPasswordAuthService } from '../../types/auth';
import { FormInput, FormButton, ErrorMessage } from '../UI';

import { resolveResetPasswordError } from './resolvePasswordAuthError';
import './PasswordAuthForms.css';

export interface ResetPasswordFormProps {
  token: string;
  authService: ResetPasswordAuthService;
  loading?: boolean;
  error?: string | null;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onBackToLogin?: () => void;
  title?: string;
  description?: string;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  token,
  authService,
  loading: externalLoading,
  error: externalError,
  onSuccess,
  onError,
  onBackToLogin,
  title = 'Новый пароль',
  description = 'Придумайте новый пароль для входа в аккаунт.',
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      const err = RESET_PASSWORD_INVALID_TOKEN;
      setError(err);
      onError?.(err);
      return;
    }

    if (!validatePassword(newPassword)) {
      const err = `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`;
      setError(err);
      onError?.(err);
      return;
    }

    if (!validatePasswordMatch(newPassword, confirmPassword)) {
      const err = 'Пароли не совпадают';
      setError(err);
      onError?.(err);
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(token, newPassword);
      setSucceeded(true);
      onSuccess?.();
    } catch (err) {
      const errorMessage = resolveResetPasswordError(err);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isLoading = externalLoading || loading;
  const displayError = externalError || error;

  if (!token.trim() && !succeeded) {
    return (
      <div className="password-auth-form">
        {title && <h2 className="password-auth-form-title">{title}</h2>}
        <ErrorMessage message={RESET_PASSWORD_INVALID_TOKEN} />
        {onBackToLogin && (
          <div className="password-auth-form-footer">
            <button type="button" className="password-auth-form-link" onClick={onBackToLogin}>
              Вернуться ко входу
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="password-auth-form">
      {title && <h2 className="password-auth-form-title">{title}</h2>}
      {description && !succeeded && <p className="password-auth-form-description">{description}</p>}

      {succeeded && (
        <div className="password-auth-form-success" role="status" aria-live="polite">
          Пароль успешно изменён. Войдите снова с новым паролем.
        </div>
      )}
      {displayError && !succeeded && <ErrorMessage message={displayError} />}

      {!succeeded && (
        <form onSubmit={handleSubmit} className="password-auth-form-content">
          <FormInput
            label="Новый пароль"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
            disabled={!newPassword || !confirmPassword}
          >
            Сохранить пароль
          </FormButton>
        </form>
      )}

      {onBackToLogin && (
        <div className="password-auth-form-footer">
          <button
            type="button"
            className="password-auth-form-link"
            onClick={onBackToLogin}
            disabled={isLoading}
          >
            Вернуться ко входу
          </button>
        </div>
      )}
    </div>
  );
};
