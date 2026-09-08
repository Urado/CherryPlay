import { LegalConsentBlock, areRequiredConsentsAccepted } from '@cherryplay/components';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { authService } from '../services/authService';
import {
  buildConsentInputsForMissing,
  ConsentDocumentsOutdatedError,
  computeMissingRequiredVersionIds,
  createConsentEvents,
  listConsentEvents,
} from '../services/consentEventsService';
import {
  clearConsentGateNotifier,
  isConsentGateOpen,
  notifyConsentRequired,
  subscribeConsentRequired,
} from '../utils/consentGateNotifier';

import './ConsentGateContext.css';

export type EnsureConsentsResult = 'ok' | 'logout' | 'error';

interface ConsentGateContextValue {
  isOpen: boolean;
  /** Resolves when grants are satisfied, user logs out from the gate, or the check fails open. */
  ensureConsents: () => Promise<EnsureConsentsResult>;
  openWithMissing: (missing?: string[]) => void;
}

const ConsentGateContext = createContext<ConsentGateContextValue>({
  isOpen: false,
  ensureConsents: async () => 'ok',
  openWithMissing: () => undefined,
});

function ConsentGateOverlay({
  missing,
  onClose,
}: {
  missing: string[] | undefined;
  onClose: (reason: 'granted' | 'logout') => void;
}) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pdConsentAccepted, setPdConsentAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const canContinue = areRequiredConsentsAccepted(pdConsentAccepted, termsAccepted) && !submitting;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const firstCheckbox = dialog.querySelector<HTMLElement>(
      'input[type="checkbox"]:not([disabled])',
    );
    (firstCheckbox ?? dialog).focus();
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled])',
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleContinue = async () => {
    if (!canContinue) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNeedsRefresh(false);
    try {
      const consents = buildConsentInputsForMissing(missing);
      await createConsentEvents(consents);
      clearConsentGateNotifier();
      onClose('granted');
    } catch (err) {
      if (err instanceof ConsentDocumentsOutdatedError) {
        setError(err.message);
        setNeedsRefresh(true);
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить согласия');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);
    try {
      await authService.logout();
      clearConsentGateNotifier();
      onClose('logout');
      navigate(ROUTES.LOGIN);
    } catch {
      setError('Не удалось выйти из аккаунта');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      className="consent-gate-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-gate-title"
      aria-describedby="consent-gate-description"
      tabIndex={-1}
      onKeyDown={trapFocus}
    >
      <div className="consent-gate-modal">
        <h2 id="consent-gate-title">Подтвердите согласия</h2>
        <p id="consent-gate-description">
          Чтобы продолжить работу, подтвердите актуальные политики сервиса.
        </p>

        <LegalConsentBlock
          pdConsentAccepted={pdConsentAccepted}
          termsAccepted={termsAccepted}
          onPdConsentChange={setPdConsentAccepted}
          onTermsChange={setTermsAccepted}
          disabled={submitting || loggingOut}
        />

        {error ? (
          <p className="consent-gate-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="consent-gate-actions">
          {needsRefresh ? (
            <button
              type="button"
              className="consent-gate-primary"
              onClick={() => window.location.reload()}
            >
              Обновить страницу
            </button>
          ) : (
            <button
              type="button"
              className="consent-gate-primary"
              disabled={!canContinue || loggingOut}
              onClick={() => void handleContinue()}
            >
              {submitting ? 'Сохранение…' : 'Продолжить'}
            </button>
          )}
          <button
            type="button"
            className="consent-gate-secondary"
            disabled={submitting || loggingOut}
            onClick={() => void handleLogout()}
          >
            {loggingOut ? 'Выход…' : 'Выйти'}
          </button>
          <Link
            className="consent-gate-tertiary"
            to={ROUTES.LEGAL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Реквизиты и контакты
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ConsentGateProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(isConsentGateOpen());
  const [missing, setMissing] = useState<string[] | undefined>(undefined);
  const appContentRef = useRef<HTMLDivElement>(null);
  const gateWaitersRef = useRef<Array<(result: EnsureConsentsResult) => void>>([]);

  const settleGateWaiters = useCallback((result: EnsureConsentsResult) => {
    const waiters = gateWaitersRef.current;
    gateWaitersRef.current = [];
    for (const resolve of waiters) {
      resolve(result);
    }
  }, []);

  const openWithMissing = useCallback((nextMissing?: string[]) => {
    notifyConsentRequired(nextMissing);
    setMissing(nextMissing);
    setOpen(true);
  }, []);

  const closeGate = useCallback(
    (reason: 'granted' | 'logout') => {
      clearConsentGateNotifier();
      setOpen(false);
      setMissing(undefined);
      settleGateWaiters(reason === 'granted' ? 'ok' : 'logout');
    },
    [settleGateWaiters],
  );

  const ensureConsents = useCallback(async (): Promise<EnsureConsentsResult> => {
    try {
      const events = await listConsentEvents();
      const nextMissing = computeMissingRequiredVersionIds(events);
      if (nextMissing.length === 0) {
        return 'ok';
      }

      openWithMissing(nextMissing);
      return new Promise<EnsureConsentsResult>((resolve) => {
        gateWaitersRef.current.push(resolve);
      });
    } catch {
      // Proactive check fail-open; write-path 403 will open the gate reactively.
      return 'error';
    }
  }, [openWithMissing]);

  useEffect(
    () =>
      subscribeConsentRequired((nextMissing) => {
        setMissing(nextMissing);
        setOpen(true);
      }),
    [],
  );

  useEffect(() => {
    const appContent = appContentRef.current;
    if (!appContent) {
      return;
    }

    if (open) {
      appContent.setAttribute('inert', '');
      appContent.setAttribute('aria-hidden', 'true');
      return;
    }

    appContent.removeAttribute('inert');
    appContent.removeAttribute('aria-hidden');
  }, [open]);

  const value = useMemo(
    () => ({
      isOpen: open,
      ensureConsents,
      openWithMissing,
    }),
    [open, ensureConsents, openWithMissing],
  );

  return (
    <ConsentGateContext.Provider value={value}>
      <div ref={appContentRef}>{children}</div>
      {open ? <ConsentGateOverlay missing={missing} onClose={closeGate} /> : null}
    </ConsentGateContext.Provider>
  );
}

export function useConsentGate(): ConsentGateContextValue {
  return useContext(ConsentGateContext);
}

export function useConsentGateOpen(): boolean {
  return useContext(ConsentGateContext).isOpen;
}
