import { Button } from '@cherryplay/components';
import React from 'react';

import { Spinner } from '@shared/components';
import { useBrowserLogin } from '@shared/hooks/useBrowserLogin';

import './BrowserLoginPanel.css';

export const BROWSER_LOGIN_PANEL_TITLE_ID = 'browser-login-panel-title';

export interface BrowserLoginPanelProps {
  title?: string;
  description?: string;
  className?: string;
}

export const BrowserLoginPanel: React.FC<BrowserLoginPanelProps> = ({
  title,
  description,
  className = '',
}) => {
  const { isWaiting, error, startLogin, retryLogin, cancelWaiting } = useBrowserLogin();

  return (
    <div className={`browser-login-panel ${className}`.trim()}>
      {title ? (
        <h2 id={BROWSER_LOGIN_PANEL_TITLE_ID} className="browser-login-panel-title">
          {title}
        </h2>
      ) : null}
      {description ? <p className="browser-login-panel-description">{description}</p> : null}

      {error ? (
        <div className="browser-login-panel-error" role="alert">
          {error}
        </div>
      ) : null}

      {isWaiting ? (
        <div className="browser-login-panel-waiting" role="status" aria-live="polite">
          <Spinner size="medium" />
          <p className="browser-login-panel-waiting-text">Завершите вход в открывшемся браузере…</p>
          <Button type="button" variant="secondary" size="sm" onClick={cancelWaiting}>
            Отмена
          </Button>
        </div>
      ) : (
        <div className="browser-login-panel-actions">
          {error ? (
            <Button
              type="button"
              onClick={() => void retryLogin()}
              className="browser-login-panel-button modal-button"
              variant="primary"
            >
              Попробовать снова
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void startLogin()}
              className="browser-login-panel-button modal-button"
              variant="primary"
            >
              Войти через браузер
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
