import { useCallback, useEffect, useState } from 'react';

import { themeAccessService } from '../services/themeAccessService';
import type { ThemeAccessDto } from '../types/api';

const ANONYMOUS_SCOPE = '__anonymous__';
const themeAccessCache = new Map<string, ThemeAccessDto>();

export function clearThemeAccessCache(): void {
  themeAccessCache.clear();
}

export function useThemeAccess(enabled = true, cacheScope?: string | null) {
  const scope = cacheScope ?? ANONYMOUS_SCOPE;
  const cachedData = themeAccessCache.get(scope) ?? null;
  const [data, setData] = useState<ThemeAccessDto | null>(cachedData);
  const [loading, setLoading] = useState(enabled && !cachedData);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const access = await themeAccessService.getMyThemeAccess();
      themeAccessCache.set(scope, access);
      setData(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить доступ к темам');
    } finally {
      setLoading(false);
    }
  }, [enabled, scope]);

  useEffect(() => {
    if (!enabled) return;
    const currentCache = themeAccessCache.get(scope);
    if (currentCache) {
      setData(currentCache);
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh, scope]);

  return { data, loading, error, refresh };
}
