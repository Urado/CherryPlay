import type { OrganizerDto } from '@cherryplay/components';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { authService } from '../services/authService';

type OrganizerWithRole = OrganizerDto & { role?: 'organizer' | 'admin' };

export function useRequireAdmin() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const organizer = (await authService.checkAuth()) as OrganizerWithRole | null;

        if (cancelled) return;

        if (!organizer) {
          setIsAdmin(false);
          navigate(ROUTES.LOGIN, { replace: true });
          return;
        }

        if (organizer.role !== 'admin') {
          setIsAdmin(false);
          navigate(ROUTES.CABINET, {
            replace: true,
            state: { deniedToast: 'Доступ запрещен: нужен администратор.' },
          });
          return;
        }

        setIsAdmin(true);
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
  }, [navigate]);

  return { checking, isAdmin };
}
