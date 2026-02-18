import React from 'react';

import type { AuthService } from '../../types/auth';

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
  if (!startOAuthFlow) {
    return null;
  }

  const handleOAuthClick = async (provider: 'telegram' | 'vk' | 'mailru') => {
    try {
      await startOAuthFlow(provider);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при запуске OAuth';
      onError?.(errorMessage);
    }
  };

  return (
    <div className="oauth-buttons">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          className={`oauth-button oauth-button--${provider}`}
          onClick={() => handleOAuthClick(provider)}
          disabled={loading}
        >
          <span className="oauth-button-icon">🔵</span>
          {PROVIDER_LABELS[provider]}
        </button>
      ))}
    </div>
  );
};
