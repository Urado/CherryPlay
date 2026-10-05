import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { useConsentGate } from '../contexts/ConsentGateContext';
import { authService } from '../services/authService';

export function useRequireAdmin() {
  const navigate = useNavigate();
  const { ensureConsents } = useConsentGate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const organizer = (await authService.checkAuth());

        if (cancelled) return;

        if (!organizer) {
          setIsAdmin(false);
          navigate(ROUTES.LOGIN, { replace: true });
          return;
        }

        if (!('role' in organizer) || organizer.role !== 'admin') {
          setIsAdmin(false);
          navigate(ROUTES.CABINET, {
            replace: true,
            state: { deniedToast: 'Доступ запрещен: нужен администратор.' },
          });
          return;
        }

        setIsAdmin(true);
        await ensureConsents();
      } catch {
        if (cancelled) return;
        setIsAdmin(false);
        navigate(ROUTES.LOGIN, { replace: true });
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [navigate, ensureConsents]);

  return { checking, isAdmin };
}
