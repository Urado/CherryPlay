import React, { useState } from 'react';

import { validateEmail, FORGOT_PASSWORD_GENERIC_SUCCESS } from '../../core/utils/authValidation';
import type { ForgotPasswordAuthService } from '../../types/auth';
import { FormInput, FormButton, ErrorMessage } from '../UI';

import { resolveForgotPasswordError } from './resolvePasswordAuthError';
import './PasswordAuthForms.css';

export interface ForgotPasswordFormProps {
  authService: ForgotPasswordAuthService;
  loading?: boolean;
  error?: string | null;
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  onBackToLogin?: () => void;
  title?: string;
  description?: string;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  authService,
  loading: externalLoading,
  error: externalError,
  onSuccess,
  onError,
  onBackToLogin,
  title = 'Восстановление пароля',
  description = 'Укажите email аккаунта. Если он зарегистрирован, мы отправим инструкции по сбросу пароля.',
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validateEmail(email)) {
      const err = 'Некорректный формат email';
      setError(err);
      onError?.(err);
      return;
    }

    setLoading(true);

    try {
      const result = await authService.forgotPassword(email.trim());
      const message =
        (result && typeof result === 'object' && result.message) || FORGOT_PASSWORD_GENERIC_SUCCESS;
      setSuccessMessage(message);
      onSuccess?.(message);
    } catch (err) {
      const errorMessage = resolveForgotPasswordError(err);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isLoading = externalLoading || loading;
  const displayError = externalError || error;

  return (
    <div className="password-auth-form">
      {title && <h2 className="password-auth-form-title">{title}</h2>}
      {description && !successMessage && (
        <p className="password-auth-form-description">{description}</p>
      )}

      {successMessage && (
        <div className="password-auth-form-success" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}
      {displayError && !successMessage && <ErrorMessage message={displayError} />}

      {!successMessage && (
        <form onSubmit={handleSubmit} className="password-auth-form-content">
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

          <FormButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={!email}
          >
            Отправить инструкции
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
