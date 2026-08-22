import React, { useState } from 'react';

import type { AuthService } from '../../types/auth';
import { ErrorMessage } from '../UI';

import { EmailAuthForm } from './EmailAuthForm';
import { OAuthButtons } from './OAuthButtons';
import './AuthForm.css';

export type AuthMode = 'email' | 'oauth';

export const AUTH_FORM_TITLE_ID = 'auth-form-title';

export interface AuthFormProps {
  title?: string;
  titleId?: string;
  description?: string;
  compact?: boolean;
  authService: AuthService;
  initialMode?: AuthMode;
  oauthEnabled?: boolean;
  onLoginSuccess?: () => void;
  onDesktopAuthSuccess?: (code: string) => void;
  onError?: (error: string) => void;
  onForgotPassword?: () => void;
  className?: string;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  title = 'Требуется авторизация',
  titleId = AUTH_FORM_TITLE_ID,
  description,
  compact = false,
  authService,
  initialMode = 'email',
  oauthEnabled = true,
  onLoginSuccess,
  onDesktopAuthSuccess,
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

  const handleDesktopAuthSuccess = (code: string) => {
    setError(null);
    onDesktopAuthSuccess?.(code);
  };

  return (
    <div
      className={`auth-form-container ${compact ? 'auth-form-container--compact' : ''} ${className}`.trim()}
    >
      <div className="auth-form-card">
        {title && (
          <h2 id={titleId} className="auth-form-title">
            {title}
          </h2>
        )}
        {description && <p className="auth-form-description">{description}</p>}

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
            onDesktopAuthSuccess={onDesktopAuthSuccess ? handleDesktopAuthSuccess : undefined}
            onError={handleError}
            onForgotPassword={onForgotPassword}
            showModeToggle={true}
          />
        )}

        {oauthEnabled && displayMode === 'oauth' && (
          <>
            {error ? <ErrorMessage message={error} /> : null}
            <OAuthButtons authService={authService} onError={handleError} />
          </>
        )}
      </div>
    </div>
  );
};
