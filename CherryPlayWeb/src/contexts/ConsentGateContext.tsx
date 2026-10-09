import { Button, LegalConsentBlock, areRequiredConsentsAccepted } from '@cherryplay/components';
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

import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { ROUTES } from '../constants/routes';
import { clearThemeAccessCache } from '../hooks/useThemeAccess';
import { deleteOrganizerAccount } from '../services/accountApiService';
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
  ensureConsents: () => Promise<EnsureConsentsResult>;
  openWithMissing: (missing?: string[]) => void;
}

const ConsentGateContext = createContext<ConsentGateContextValue>({
  isOpen: false,
  ensureConsents: () => Promise.resolve('ok'),
  openWithMissing: () => undefined,
});

const ConsentGateOverlay = ({
  missing,
  onClose,
}: {
  missing: string[] | undefined;
  onClose: (reason: 'granted' | 'logout') => void;
}) => {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pdConsentAccepted, setPdConsentAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
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

  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
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
      await navigate(ROUTES.LOGIN);
    } catch {
      setError('Не удалось выйти из аккаунта');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setError(null);
    try {
      await deleteOrganizerAccount();
      clearThemeAccessCache();
      await authService.logout();
      onClose('logout');
      await navigate(ROUTES.LOGIN, { replace: true, state: { accountDeleted: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить аккаунт');
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <dialog
      open
      ref={dialogRef}
      className="consent-gate-backdrop"
      data-shell-theme="dark"
      aria-modal="true"
      aria-labelledby="consent-gate-title"
      aria-describedby="consent-gate-description"
      onKeyDown={trapFocus}
    >
      <div className="consent-gate-modal">
        <h2 id="consent-gate-title">Подтвердите согласия</h2>
        <p id="consent-gate-description">
          Чтобы продолжить работу, подтвердите актуальные политики сервиса. Можно выйти или
          удалить аккаунт без их принятия.
        </p>

        <LegalConsentBlock
          pdConsentAccepted={pdConsentAccepted}
          termsAccepted={termsAccepted}
          onPdConsentChange={setPdConsentAccepted}
          onTermsChange={setTermsAccepted}
          disabled={submitting || loggingOut || deletingAccount}
        />

        {error ? (
          <p className="consent-gate-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="consent-gate-actions">
          {needsRefresh ? (
            <Button
              type="button"
              variant="primary"
              className="consent-gate-primary"
              onClick={() => window.location.reload()}
            >
              Обновить страницу
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              className="consent-gate-primary"
              disabled={!canContinue || loggingOut || deletingAccount}
              onClick={() => void handleContinue()}
            >
              {submitting ? 'Сохранение…' : 'Продолжить'}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            className="consent-gate-secondary"
            disabled={submitting || loggingOut || deletingAccount}
            onClick={() => void handleLogout()}
          >
            {loggingOut ? 'Выход…' : 'Выйти'}
          </Button>
          <Button
            type="button"
            variant="danger"
            className="consent-gate-danger"
            disabled={submitting || loggingOut || deletingAccount}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Удалить аккаунт
          </Button>
          <Link
            className="consent-gate-tertiary"
            to={ROUTES.LEGAL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Реквизиты и контакты (откроется в новой вкладке)"
          >
            Реквизиты и контакты
          </Link>
        </div>
      </div>
      <ConfirmActionDialog
        open={deleteDialogOpen}
        title="Удалить аккаунт?"
        description="Профиль будет обезличен, вход станет невозможен. Вечеринки могут остаться в каталоге без ваших контактов. Это действие необратимо."
        confirmLabel="Удалить навсегда"
        confirming={deletingAccount}
        onCancel={() => {
          if (!deletingAccount) {
            setDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => void handleDeleteAccount()}
      />
    </dialog>
  );
};

export const ConsentGateProvider = ({ children }: { children: ReactNode }) => {
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
};

export const useConsentGate = (): ConsentGateContextValue => {
  return useContext(ConsentGateContext);
};

export const useConsentGateOpen = (): boolean => {
  return useContext(ConsentGateContext).isOpen;
};
