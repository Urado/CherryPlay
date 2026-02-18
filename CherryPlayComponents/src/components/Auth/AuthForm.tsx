import React, { useState } from 'react';

import type { AuthService } from '../../types/auth';

import { EmailAuthForm } from './EmailAuthForm';
import { OAuthButtons } from './OAuthButtons';
import './AuthForm.css';

export type AuthMode = 'email' | 'oauth';

export interface AuthFormProps {
  title?: string;
  description?: string;
  compact?: boolean;
  authService: AuthService;
  initialMode?: AuthMode;
  onLoginSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  title = 'Требуется авторизация',
  description,
  compact = false,
  authService,
  initialMode = 'email',
  onLoginSuccess,
  onError,
  className = '',
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [error, setError] = useState<string | null>(null);

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
  };

  const handleSuccess = () => {
    setError(null);
    onLoginSuccess?.();
  };

  return (
    <div
      className={`auth-form-container ${compact ? 'auth-form-container--compact' : ''} ${className}`.trim()}
    >
      <div className="auth-form-card">
        {title && <h2 className="auth-form-title">{title}</h2>}

        {description && (
          <div className="auth-form-warning">
            <strong>⚠ {description}</strong>
            {!compact && <p>Войдите в систему, чтобы создавать вечеринки и управлять эфиром.</p>}
          </div>
        )}

        {error && <div className="auth-form-error">{error}</div>}

        <div className="auth-form-tabs">
          <button
            type="button"
            className={`auth-form-tab ${mode === 'email' ? 'auth-form-tab--active' : ''}`}
            onClick={() => {
              setMode('email');
              setError(null);
            }}
          >
            Email / Пароль
          </button>
          <button
            type="button"
            className={`auth-form-tab ${mode === 'oauth' ? 'auth-form-tab--active' : ''}`}
            onClick={() => {
              setMode('oauth');
              setError(null);
            }}
          >
            OAuth
          </button>
        </div>

        {mode === 'email' && (
          <EmailAuthForm
            mode="login"
            authService={authService}
            error={error}
            onSuccess={handleSuccess}
            onError={handleError}
            showModeToggle={true}
          />
        )}

        {mode === 'oauth' && <OAuthButtons authService={authService} onError={handleError} />}

        {!compact && (
          <p className="auth-form-footer">
            После входа вы сможете создавать вечеринки и управлять трансляцией
          </p>
        )}
      </div>
    </div>
  );
};
