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
  oauthEnabled?: boolean;
  onLoginSuccess?: () => void;
  onError?: (error: string) => void;
  onForgotPassword?: () => void;
  className?: string;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  title = 'Требуется авторизация',
  description,
  compact = false,
  authService,
  initialMode = 'email',
  oauthEnabled = true,
  onLoginSuccess,
  onError,
  onForgotPassword,
  className = '',
}) => {
  const effectiveInitialMode = oauthEnabled ? initialMode : 'email';
  const [mode, setMode] = useState<AuthMode>(effectiveInitialMode);
  const [error, setError] = useState<string | null>(null);

  const displayMode: AuthMode = !oauthEnabled && mode === 'oauth' ? 'email' : mode;

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
        {description && <p className="auth-form-description">{description}</p>}

        {error && <div className="auth-form-error">{error}</div>}

        <div className="auth-form-tabs">
          <button
            type="button"
            className={`auth-form-tab ${displayMode === 'email' ? 'auth-form-tab--active' : ''}`}
            onClick={() => {
              setMode('email');
              setError(null);
            }}
          >
            Email / Пароль
          </button>
          {oauthEnabled && (
            <button
              type="button"
              className={`auth-form-tab ${displayMode === 'oauth' ? 'auth-form-tab--active' : ''}`}
              onClick={() => {
                setMode('oauth');
                setError(null);
              }}
            >
              OAuth
            </button>
          )}
        </div>

        {displayMode === 'email' && (
          <EmailAuthForm
            mode="login"
            authService={authService}
            error={error}
            onSuccess={handleSuccess}
            onError={handleError}
            onForgotPassword={onForgotPassword}
            showModeToggle={true}
          />
        )}

        {oauthEnabled && displayMode === 'oauth' && (
          <OAuthButtons authService={authService} onError={handleError} />
        )}
      </div>
    </div>
  );
};
