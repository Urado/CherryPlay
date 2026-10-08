import type { OrganizerDto } from '@cherryplay/components';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';


import { AUTH_STATE_CHANGED_EVENT, authService } from '../services/authService';

interface SiteAuthState {
  organizer: OrganizerDto | null;
  checked: boolean;
}

const SiteAuthContext = createContext<SiteAuthState>({
  organizer: null,
  checked: false,
});

export const SiteAuthProvider = ({ children }: PropsWithChildren) => {
  const [organizer, setOrganizer] = useState<OrganizerDto | null>(null);
  const [checked, setChecked] = useState(false);
  const requestSequence = useRef(0);

  const refreshAuth = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setChecked(false);

    let currentOrganizer: OrganizerDto | null = null;
    try {
      currentOrganizer = await authService.checkAuth();
    } catch {
      currentOrganizer = null;
    }

    if (requestId !== requestSequence.current) {
      return;
    }

    setOrganizer(currentOrganizer);
    setChecked(true);
  }, []);

  useEffect(() => {
    const handleAuthStateChanged = () => {
      void refreshAuth();
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
    void refreshAuth();

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
      requestSequence.current += 1;
    };
  }, [refreshAuth]);

  return (
    <SiteAuthContext.Provider value={{ organizer, checked }}>
      {children}
    </SiteAuthContext.Provider>
  );
};

export const useSiteAuth = () => useContext(SiteAuthContext);
