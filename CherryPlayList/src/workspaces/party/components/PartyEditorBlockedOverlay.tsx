import { AuthForm } from '@cherryplay/components';
import React from 'react';

import { OnlineUnavailablePanel, Spinner } from '@shared/components';
import { authService } from '@shared/services/authService';

import type { PartyEditorBlockedReason } from '../partyEditorPhase';

import './PartyEditorShell.css';

export interface PartyEditorBlockedOverlayProps {
  reason: PartyEditorBlockedReason;
  clientRequiredVersion?: string | null;
  isReconnecting?: boolean;
  lastManualCheckFailed?: boolean;
  onManualReconnect?: () => void;
  onResetAndCreateNew?: () => void;
}

export const PartyEditorBlockedOverlay: React.FC<PartyEditorBlockedOverlayProps> = ({
  reason,
  clientRequiredVersion,
  isReconnecting = false,
  lastManualCheckFailed = false,
  onManualReconnect,
  onResetAndCreateNew,
}) => {
  return (
    <div
      className="party-editor-shell-blocked-overlay"
      role={reason === 'checking' ? 'presentation' : 'dialog'}
      aria-modal={reason === 'checking' ? undefined : true}
      aria-label={reason === 'checking' ? 'Идёт загрузка состояния вечеринки' : undefined}
    >
      <div className="party-editor-shell-blocked-overlay-content">
        {reason === 'auth' && (
          <AuthForm
            title="Требуется авторизация"
            description="Для работы с вечеринками необходимо войти в аккаунт"
            compact={false}
            authService={authService}
          />
        )}

        {reason === 'outdated' && (
          <OnlineUnavailablePanel reason="outdated" requiredVersion={clientRequiredVersion} />
        )}

        {reason === 'checking' && (
          <div
            className="party-editor-shell-blocked-spinner"
            role="status"
            aria-live="polite"
            aria-label="Идёт загрузка состояния вечеринки"
          >
            <Spinner size="large" />
          </div>
        )}

        {reason === 'unreachable' && (
          <OnlineUnavailablePanel
            reason="connection"
            isReconnecting={isReconnecting}
            lastCheckFailed={lastManualCheckFailed}
            onRetry={onManualReconnect ? () => void onManualReconnect() : undefined}
          />
        )}

        {reason === 'party-not-found' && (
          <div className="party-editor-shell-party-not-found">
            <h3 className="party-editor-shell-party-not-found-title">
              Привязанная вечеринка удалена
            </h3>
            <p className="party-editor-shell-party-not-found-text">
              На сервере эта вечеринка больше недоступна. Можно сбросить привязку и выбрать другую.
            </p>
            <button
              type="button"
              className="action-button party-editor-shell-party-not-found-button"
              onClick={() => void onResetAndCreateNew?.()}
            >
              Сбросить привязку
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
