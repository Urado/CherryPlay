import { useEffect, useState } from 'react';

import { partyService } from '../services/partyService';

const resolveSynchronousUrl = (shortCode: string | null | undefined): string | null => {
  if (!shortCode) {
    return null;
  }

  try {
    return partyService.getPartyUrlSync(shortCode);
  } catch {
    return null;
  }
};

export const usePartyPublicUrl = (
  shortCode: string | null | undefined,
  savedUrl?: string | null,
): string | null => {
  const [partyUrl, setPartyUrl] = useState<{ shortCode: string | null | undefined; url: string | null }>(
    () => ({
      shortCode,
      url: resolveSynchronousUrl(shortCode) ?? savedUrl ?? null,
    }),
  );

  useEffect(() => {
    let active = true;

    if (!shortCode) {
      setPartyUrl({ shortCode, url: null });
      return () => {
        active = false;
      };
    }

    setPartyUrl({ shortCode, url: resolveSynchronousUrl(shortCode) ?? savedUrl ?? null });
    void partyService
      .getPartyUrl(shortCode)
      .then((nextUrl) => {
        if (active) {
          setPartyUrl({ shortCode, url: nextUrl });
        }
      })
      .catch(() => {
        if (active && savedUrl) {
          setPartyUrl({ shortCode, url: savedUrl });
        }
      });

    return () => {
      active = false;
    };
  }, [shortCode, savedUrl]);

  return partyUrl.shortCode === shortCode ? partyUrl.url : null;
};
