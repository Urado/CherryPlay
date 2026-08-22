import {
  AuthForm,
  FormButton,
  buildAuthReturnUrl,
  getAuthErrorMessage,
  resolveDesktopAuthReturnTo,
} from '@cherryplay/components';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link, useSearchParams } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { useAppConfig } from '../contexts/AppConfigContext';
import { authService } from '../services/authService';
import {
  isDesktopClientQueryValue,
  syncDesktopClientModeFromQuery,
} from '../utils/desktopClientMode';
import './LoginPage.css';

type LoginLocationState = { passwordChanged?: boolean } | null;
type DesktopSessionView = 'checking' | 'continue' | 'form';

const DESKTOP_SESSION_PROBE_TIMEOUT_MS = 10000;

function DesktopReturnToAppNotice({ returnUrl }: { returnUrl: string }) {
  return (
    <div className="login-page">
      <div className="login-page-notice" role="status" aria-live="polite">
        Возвращаемся в приложение…
      </div>
      <p className="login-page-return-fallback">
        Если приложение не открылось автоматически,{' '}
        <a href={returnUrl}>нажмите здесь, чтобы вернуться в CherryPlayList</a>.
      </p>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { oauthEnabled } = useAppConfig();
  const [passwordChangedNotice] = useState(
    () => (location.state as LoginLocationState)?.passwordChanged === true,
  );
  const [returningToApp, setReturningToApp] = useState(false);
  const [pendingDesktopCode, setPendingDesktopCode] = useState<string | null>(null);
  const desktopMode = isDesktopClientQueryValue(searchParams.get('client'));
  const desktopCodeFromUrl = desktopMode ? searchParams.get('code') : null;
  const [desktopSessionView, setDesktopSessionView] = useState<DesktopSessionView>(() => {
    if (!desktopMode) {
      return 'form';
    }
    if (desktopCodeFromUrl) {
      return 'form';
    }
    return 'checking';
  });
  const [sessionContinueError, setSessionContinueError] = useState<string | null>(null);
  const [issuingDesktopCode, setIssuingDesktopCode] = useState(false);
  const returnTo = useMemo(
    () => resolveDesktopAuthReturnTo(searchParams.get('return_to')),
    [searchParams],
  );

  useEffect(() => {
    syncDesktopClientModeFromQuery(searchParams.get('client'));
  }, [searchParams]);

  useEffect(() => {
    if (!desktopCodeFromUrl) {
      return;
    }
    setPendingDesktopCode(desktopCodeFromUrl);
    setReturningToApp(true);
  }, [desktopCodeFromUrl]);

  useEffect(() => {
    if (!desktopMode || desktopCodeFromUrl) {
      if (!desktopMode) {
        setDesktopSessionView('form');
        setSessionContinueError(null);
      }
      return;
    }

    let cancelled = false;
    setDesktopSessionView('checking');
    setSessionContinueError(null);

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setDesktopSessionView('form');
    }, DESKTOP_SESSION_PROBE_TIMEOUT_MS);

    void (async () => {
      try {
        const organizer = await authService.checkAuth();
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setDesktopSessionView(organizer ? 'continue' : 'form');
      } catch {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setDesktopSessionView('form');
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [desktopMode, desktopCodeFromUrl]);

  useEffect(() => {
    if (!passwordChangedNotice) return;
    if (!(location.state as LoginLocationState)?.passwordChanged) return;
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.state, navigate, passwordChangedNotice]);

  const handleLoginSuccess = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const organizer = await authService.checkAuth?.();
    if (organizer) {
      navigate(ROUTES.CABINET);
    }
  };

  const handleDesktopAuthSuccess = (code: string) => {
    setReturningToApp(true);
    setPendingDesktopCode(code);
  };

  const handleSessionContinue = async () => {
    setIssuingDesktopCode(true);
    setSessionContinueError(null);
    try {
      const code = await authService.issueDesktopAuthCode();
      handleDesktopAuthSuccess(code);
    } catch (error) {
      const message = getAuthErrorMessage(error).trim();
      setSessionContinueError(message || 'Не удалось продолжить вход. Войдите снова через форму.');
      setDesktopSessionView('form');
    } finally {
      setIssuingDesktopCode(false);
    }
  };

  useEffect(() => {
    if (!returningToApp || !pendingDesktopCode) return;
    const returnUrl = buildAuthReturnUrl(returnTo, pendingDesktopCode);
    const timeoutId = window.setTimeout(() => {
      window.location.assign(returnUrl);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [returningToApp, pendingDesktopCode, returnTo]);

  const registerParams = new URLSearchParams();
  if (desktopMode) {
    registerParams.set('client', 'desktop');
  }
  if (searchParams.get('return_to')) {
    registerParams.set('return_to', searchParams.get('return_to')!);
  }
  const registerHref =
    registerParams.size > 0 ? `${ROUTES.REGISTER}?${registerParams.toString()}` : ROUTES.REGISTER;

  if (returningToApp && pendingDesktopCode) {
    return (
      <DesktopReturnToAppNotice returnUrl={buildAuthReturnUrl(returnTo, pendingDesktopCode)} />
    );
  }

  if (desktopMode && desktopSessionView === 'checking') {
    return (
      <div className="login-page">
        <div className="login-page-checking" role="status" aria-live="polite">
          <div className="login-page-checking-spinner" aria-hidden="true" />
          <div className="login-page-notice">Проверяем сессию…</div>
        </div>
      </div>
    );
  }

  if (desktopMode && desktopSessionView === 'continue') {
    return (
      <div className="login-page">
        <div className="login-page-session-continue login-page-form">
          <h1 className="login-page-session-continue-title">Вход в CherryPlayList</h1>
          <p className="login-page-session-continue-description">
            Вы уже вошли в CherryPlay. Нажмите «Войти», чтобы открыть приложение.
          </p>
          <FormButton
            type="button"
            fullWidth
            loading={issuingDesktopCode}
            disabled={issuingDesktopCode}
            onClick={() => {
              void handleSessionContinue();
            }}
          >
            Войти
          </FormButton>
          <FormButton
            type="button"
            fullWidth
            variant="outline"
            disabled={issuingDesktopCode}
            className="login-page-session-continue-other"
            onClick={() => {
              setSessionContinueError(null);
              setDesktopSessionView('form');
            }}
          >
            Войти другим аккаунтом
          </FormButton>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {passwordChangedNotice && (
        <div className="login-page-notice" role="status" aria-live="polite">
          Пароль успешно изменён. Войдите снова с новым паролем.
        </div>
      )}
      {sessionContinueError && (
        <div className="login-page-error" role="alert">
          {sessionContinueError}
        </div>
      )}
      <AuthForm
        title="Вход в систему"
        description="Войдите, чтобы управлять вечеринками"
        authService={authService}
        oauthEnabled={oauthEnabled}
        onLoginSuccess={handleLoginSuccess}
        onDesktopAuthSuccess={desktopMode ? handleDesktopAuthSuccess : undefined}
        onForgotPassword={() => navigate(ROUTES.FORGOT_PASSWORD)}
        className="login-page-form"
      />
      <div className="register-link">
        Нет аккаунта? <Link to={registerHref}>Зарегистрироваться</Link>
      </div>
    </div>
  );
}
