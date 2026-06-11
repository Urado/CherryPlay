import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { isClientOutdated, subscribeClientOutdated } from '../utils/clientOutdatedNotifier';

import './ClientOutdatedContext.css';

const ClientOutdatedContext = createContext(false);

function ClientOutdatedOverlay() {
  const refreshButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    refreshButtonRef.current?.focus();
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') {
      return;
    }

    event.preventDefault();
    refreshButtonRef.current?.focus();
  };

  return (
    <div
      className="client-outdated-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-outdated-title"
      aria-describedby="client-outdated-description"
      tabIndex={-1}
      onKeyDown={trapFocus}
    >
      <div className="client-outdated-modal">
        <h2 id="client-outdated-title">Версия приложения устарела</h2>
        <p id="client-outdated-description">Обновите страницу, чтобы продолжить работу.</p>
        <button ref={refreshButtonRef} type="button" onClick={() => window.location.reload()}>
          Обновить страницу
        </button>
      </div>
    </div>
  );
}

export function ClientOutdatedProvider({ children }: { children: ReactNode }) {
  const [outdated, setOutdated] = useState(isClientOutdated());
  const appContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeClientOutdated(() => setOutdated(true)), []);

  useEffect(() => {
    const appContent = appContentRef.current;
    if (!appContent) {
      return;
    }

    if (outdated) {
      appContent.setAttribute('inert', '');
      appContent.setAttribute('aria-hidden', 'true');
      return;
    }

    appContent.removeAttribute('inert');
    appContent.removeAttribute('aria-hidden');
  }, [outdated]);

  return (
    <ClientOutdatedContext.Provider value={outdated}>
      <div ref={appContentRef}>{children}</div>
      {outdated ? <ClientOutdatedOverlay /> : null}
    </ClientOutdatedContext.Provider>
  );
}

export function useClientOutdated(): boolean {
  return useContext(ClientOutdatedContext);
}
