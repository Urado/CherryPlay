import {
  FormButton,
  LegalConsentBlock,
  areRequiredConsentsAccepted,
  buildAuthReturnUrl,
  buildRequiredConsentInputs,
  clearOAuthPendingConsents,
  getAuthErrorMessage,
  readOAuthPendingConsents,
  resolveDesktopAuthReturnTo,
  type ConsentInput,
} from '@cherryplay/components';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { SiteFooter } from '../components/SiteFooter';
import { ROUTES } from '../constants/routes';
import { useConsentGate } from '../contexts/ConsentGateContext';
import { authService } from '../services/authService';
import {
  isDesktopClientQueryValue,
  syncDesktopClientModeFromQuery,
} from '../utils/desktopClientMode';
import './OAuthCompletePage.css';

type OAuthCompleteProviderId = 'vk' | 'mailru';

const OAUTH_COMPLETE_PROVIDERS: readonly OAuthCompleteProviderId[] = ['vk', 'mailru'];

function isOAuthCompleteProviderId(value: string | null): value is OAuthCompleteProviderId {
  return value !== null && (OAUTH_COMPLETE_PROVIDERS as readonly string[]).includes(value);
}

export function OAuthCompletePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { ensureConsents } = useConsentGate();
  const consentHintId = useId();
  const autoStartedRef = useRef(false);

  const providerParam = searchParams.get('provider');
  const codeFromQuery = searchParams.get('code');
  const desktopModeFromQuery = isDesktopClientQueryValue(searchParams.get('client'));
  const returnToFromQuery = useMemo(
    () => resolveDesktopAuthReturnTo(searchParams.get('return_to')),
    [searchParams],
  );

  const provider = isOAuthCompleteProviderId(providerParam) ? providerParam : null;
  const queryValid = Boolean(provider && codeFromQuery);

  const desktopModeRef = useRef(desktopModeFromQuery);
  const returnToRef = useRef(returnToFromQuery);
  const codeRef = useRef(codeFromQuery);
  const providerRef = useRef(provider);

  useEffect(() => {
    desktopModeRef.current = desktopModeFromQuery;
  }, [desktopModeFromQuery]);

  useEffect(() => {
    returnToRef.current = returnToFromQuery;
  }, [returnToFromQuery]);

  useEffect(() => {
    if (codeFromQuery) {
      codeRef.current = codeFromQuery;
    }
  }, [codeFromQuery]);

  useEffect(() => {
    if (provider) {
      providerRef.current = provider;
    }
  }, [provider]);

  const [pdConsentAccepted, setPdConsentAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [needsConsentUi, setNeedsConsentUi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [postAuthBlocked, setPostAuthBlocked] = useState(false);
  const [returningToApp, setReturningToApp] = useState(false);
  const [pendingDesktopCode, setPendingDesktopCode] = useState<string | null>(null);

  const consentsAccepted = areRequiredConsentsAccepted(pdConsentAccepted, termsAccepted);

  useEffect(() => {
    syncDesktopClientModeFromQuery(searchParams.get('client'));
  }, [searchParams]);

  const stripSensitiveQuery = useCallback(() => {
    navigate(ROUTES.OAUTH_COMPLETE, { replace: true });
  }, [navigate]);

  const finishSuccess = useCallback(async () => {
    clearOAuthPendingConsents();
    setAccountCreated(true);
    stripSensitiveQuery();

    const consentResult = await ensureConsents();
    if (consentResult !== 'ok') {
      setPostAuthBlocked(true);
      setNeedsConsentUi(false);
      setError(
        consentResult === 'logout'
          ? 'Сессия завершена. Войдите снова.'
          : 'Не удалось подтвердить согласия. Обновите страницу или войдите снова.',
      );
      return;
    }

    if (desktopModeRef.current) {
      const desktopCode = await authService.issueDesktopAuthCode();
      setPendingDesktopCode(desktopCode);
      setReturningToApp(true);
      return;
    }

    navigate(ROUTES.CABINET, { replace: true });
  }, [ensureConsents, navigate, stripSensitiveQuery]);

  const completeWithConsents = useCallback(
    async (consents: ConsentInput[]) => {
      const activeProvider = providerRef.current;
      const activeCode = codeRef.current;
      if (!activeProvider || !activeCode) {
        return;
      }
      setLoading(true);
      setError(null);
      setPostAuthBlocked(false);
      try {
        await authService.createOAuthAccount({
          provider: activeProvider,
          code: activeCode,
          consents,
        });
        await finishSuccess();
      } catch (err) {
        setError(getAuthErrorMessage(err).trim() || 'Не удалось завершить вход через OAuth');
        setNeedsConsentUi(true);
        setPostAuthBlocked(false);
      } finally {
        setLoading(false);
      }
    },
    [finishSuccess],
  );

  useEffect(() => {
    if (!queryValid) {
      if (!accountCreated && !postAuthBlocked) {
        setNeedsConsentUi(false);
      }
      return;
    }
    if (autoStartedRef.current || accountCreated || postAuthBlocked) {
      return;
    }

    const pending = readOAuthPendingConsents();
    if (pending) {
      autoStartedRef.current = true;
      void completeWithConsents(pending);
      return;
    }

    setNeedsConsentUi(true);
  }, [accountCreated, completeWithConsents, postAuthBlocked, queryValid]);

  useEffect(() => {
    if (!returningToApp || !pendingDesktopCode) {
      return;
    }
    const returnUrl = buildAuthReturnUrl(returnToRef.current, pendingDesktopCode);
    const timeoutId = window.setTimeout(() => {
      window.location.assign(returnUrl);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [returningToApp, pendingDesktopCode]);

  const handleContinue = () => {
    if (!consentsAccepted) {
      return;
    }
    void completeWithConsents(buildRequiredConsentInputs());
  };

  if (returningToApp && pendingDesktopCode) {
    const returnUrl = buildAuthReturnUrl(returnToRef.current, pendingDesktopCode);
    return (
      <div className="oauth-complete-page">
        <div className="oauth-complete-page-notice" role="status" aria-live="polite">
          Возвращаемся в приложение…
        </div>
        <p className="oauth-complete-page-return-fallback">
          Если приложение не открылось автоматически,{' '}
          <a href={returnUrl}>нажмите здесь, чтобы вернуться в CherryPlayList</a>.
        </p>
      </div>
    );
  }

  if (postAuthBlocked) {
    return (
      <div className="oauth-complete-page">
        <div className="oauth-complete-page-body">
          <div className="oauth-complete-page-card">
            <h1 className="oauth-complete-page-title">Вход не завершён</h1>
            <p className="oauth-complete-page-error" role="alert">
              {error ?? 'Не удалось подтвердить согласия. Войдите снова.'}
            </p>
            <FormButton type="button" fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
              Вернуться ко входу
            </FormButton>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!queryValid && !accountCreated) {
    return (
      <div className="oauth-complete-page">
        <div className="oauth-complete-page-body">
          <div className="oauth-complete-page-card">
            <h1 className="oauth-complete-page-title">Ошибка OAuth</h1>
            <p className="oauth-complete-page-error" role="alert">
              {!providerParam
                ? 'Не указан провайдер OAuth.'
                : !provider
                  ? 'Неподдерживаемый провайдер OAuth.'
                  : 'Отсутствует код авторизации. Начните вход заново.'}
            </p>
            <FormButton type="button" fullWidth onClick={() => navigate(ROUTES.LOGIN)}>
              Вернуться ко входу
            </FormButton>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="oauth-complete-page">
      <div className="oauth-complete-page-body">
        <div className="oauth-complete-page-card">
          <h1 className="oauth-complete-page-title">Завершение входа</h1>
          <p className="oauth-complete-page-description">
            {needsConsentUi
              ? 'Подтвердите согласия, чтобы завершить вход через OAuth'
              : 'Завершаем вход…'}
          </p>

          {error ? (
            <div className="oauth-complete-page-error" role="alert">
              {error}
            </div>
          ) : null}

          {needsConsentUi ? (
            <>
              <LegalConsentBlock
                pdConsentAccepted={pdConsentAccepted}
                termsAccepted={termsAccepted}
                onPdConsentChange={setPdConsentAccepted}
                onTermsChange={setTermsAccepted}
                disabled={loading}
              />
              {!consentsAccepted ? (
                <p id={consentHintId} className="oauth-complete-page-consent-hint">
                  Отметьте оба согласия, чтобы продолжить
                </p>
              ) : null}
              <FormButton
                type="button"
                fullWidth
                loading={loading}
                disabled={loading || !consentsAccepted}
                aria-describedby={!consentsAccepted ? consentHintId : undefined}
                onClick={handleContinue}
              >
                Продолжить
              </FormButton>
            </>
          ) : (
            <div className="oauth-complete-page-checking" role="status" aria-live="polite">
              <div className="oauth-complete-page-checking-spinner" aria-hidden="true" />
              <div className="oauth-complete-page-notice">Завершаем вход…</div>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
