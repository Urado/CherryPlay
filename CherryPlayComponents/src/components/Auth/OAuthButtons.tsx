import React, { useId, useState } from 'react';

import {
  areRequiredConsentsAccepted,
  buildRequiredConsentInputs,
} from '../../constants/legalDocuments';
import { stashOAuthPendingConsents } from '../../constants/oauthPendingConsents';
import type { AuthService } from '../../types/auth';

import { LegalConsentBlock } from './LegalConsentBlock';
import './OAuthButtons.css';

export interface OAuthButtonsProps {
  authService: AuthService;
  loading?: boolean;
  onError?: (error: string) => void;
  providers?: Array<'telegram' | 'vk' | 'mailru'>;
}

const PROVIDER_LABELS: Record<'telegram' | 'vk' | 'mailru', string> = {
  telegram: 'Войти через Telegram',
  vk: 'Войти через VK',
  mailru: 'Войти через Mail.ru',
};

export const OAuthButtons: React.FC<OAuthButtonsProps> = ({
  authService,
  loading = false,
  onError,
  providers = ['telegram', 'vk', 'mailru'],
}) => {
  const startOAuthFlow = authService.startOAuthFlow;
  const [pdConsentAccepted, setPdConsentAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const consentHintId = useId();

  if (!startOAuthFlow) {
    return null;
  }

  const consentsAccepted = areRequiredConsentsAccepted(pdConsentAccepted, termsAccepted);
  const buttonsDisabled = loading || !consentsAccepted;

  const handleOAuthClick = async (provider: 'telegram' | 'vk' | 'mailru') => {
    if (!consentsAccepted) {
      return;
    }
    try {
      const consents = buildRequiredConsentInputs();
      stashOAuthPendingConsents(consents);
      await startOAuthFlow(provider);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при запуске OAuth';
      onError?.(errorMessage);
    }
  };

  return (
    <div className="oauth-buttons">
      <LegalConsentBlock
        pdConsentAccepted={pdConsentAccepted}
        termsAccepted={termsAccepted}
        onPdConsentChange={setPdConsentAccepted}
        onTermsChange={setTermsAccepted}
        disabled={loading}
      />

      {!consentsAccepted && (
        <p id={consentHintId} className="oauth-consent-hint">
          Отметьте оба согласия, чтобы продолжить
        </p>
      )}

      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          className={`oauth-button oauth-button--${provider}`}
          onClick={() => {
            void handleOAuthClick(provider);
          }}
          disabled={buttonsDisabled}
          aria-describedby={!consentsAccepted ? consentHintId : undefined}
        >
          <span className="oauth-button-icon">🔵</span>
          {PROVIDER_LABELS[provider]}
        </button>
      ))}
    </div>
  );
};
