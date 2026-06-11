import type { VisibleLockedThemeDto } from '../types/api';
import { sanitizeExternalUrl } from '../utils/urlSafety';

interface ThemeLockedTileProps {
  themeName: string;
  lockedTheme: VisibleLockedThemeDto;
  contactUrl: string;
}

export function ThemeLockedTile({ themeName, lockedTheme, contactUrl }: ThemeLockedTileProps) {
  const safeContactUrl = sanitizeExternalUrl(contactUrl);

  return (
    <div className="theme-locked-tile" role="note" aria-label={`Тема ${themeName} заблокирована`}>
      <span className="theme-locked-tile__icon" aria-hidden="true">
        🔒
      </span>
      <div className="theme-locked-tile__content">
        <strong>{themeName}</strong>
        <p>
          Доступно в пакете <strong>{lockedTheme.packageName}</strong>.
        </p>
        {safeContactUrl ? (
          <a href={safeContactUrl} target="_blank" rel="noopener noreferrer">
            Связаться с администратором
          </a>
        ) : (
          <span>Свяжитесь с администратором для получения доступа.</span>
        )}
      </div>
    </div>
  );
}
