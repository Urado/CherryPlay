import React, { useState } from 'react';

import {
  validatePassword,
  validatePasswordMatch,
  MIN_PASSWORD_LENGTH,
} from '../../core/utils/authValidation';
import type { ChangePasswordAuthService } from '../../types/auth';
import { FormInput, FormButton, ErrorMessage } from '../UI';

import { resolveChangePasswordError } from './resolvePasswordAuthError';
import './PasswordAuthForms.css';

export interface ChangePasswordFormProps {
  authService: ChangePasswordAuthService;
  loading?: boolean;
  error?: string | null;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  title?: string | null;
  description?: string;
  layout?: 'standalone' | 'embedded';
  className?: string;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  authService,
  loading: externalLoading,
  error: externalError,
  onSuccess,
  onError,
  title: titleProp,
  description = 'После смены пароля потребуется войти заново на всех устройствах.',
  layout = 'standalone',
  className = '',
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const isEmbedded = layout === 'embedded';
  const title = titleProp !== undefined ? titleProp : isEmbedded ? null : 'Смена пароля';
  const hostOwnsSuccessFeedback = typeof onSuccess === 'function';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!oldPassword) {
      const err = 'Укажите текущий пароль';
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

    if (oldPassword === newPassword) {
      const err = 'Новый пароль должен отличаться от текущего';
      setError(err);
      onError?.(err);
      return;
    }

    setLoading(true);

    try {
      await authService.changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (hostOwnsSuccessFeedback) {
        onSuccess?.();
      } else {
        setSucceeded(true);
      }
    } catch (err) {
      const errorMessage = resolveChangePasswordError(err);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isLoading = externalLoading || loading;
  const displayError = externalError || error;
  const rootClassName = [
    'password-auth-form',
    isEmbedded ? 'password-auth-form--embedded' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName}>
      {title ? <h2 className="password-auth-form-title">{title}</h2> : null}
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
            label="Текущий пароль"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
            autoComplete="current-password"
          />

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
            label="Подтвердите новый пароль"
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
            variant={isEmbedded ? 'secondary' : 'primary'}
            fullWidth={!isEmbedded}
            loading={isLoading}
            disabled={!oldPassword || !newPassword || !confirmPassword}
            className={isEmbedded ? 'password-auth-form-submit--embedded' : undefined}
          >
            Сменить пароль
          </FormButton>
        </form>
      )}
    </div>
  );
};
