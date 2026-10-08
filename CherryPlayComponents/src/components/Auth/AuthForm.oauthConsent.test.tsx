import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { AuthService } from '../../types/auth';

import { AuthForm } from './AuthForm';

function createAuthService(): AuthService {
  return {
    login: vi.fn(),
    register: vi.fn(),
    startOAuthFlow: vi.fn(),
  };
}

describe('AuthForm OAuth consent gate', () => {
  it('renders LegalConsentBlock on oauth tab with disabled providers', () => {
    const html = renderToStaticMarkup(
      <AuthForm authService={createAuthService()} initialMode="oauth" oauthEnabled={true} />,
    );

    expect(html).toContain('legal-consent-block');
    expect(html).toContain('Отметьте оба согласия, чтобы продолжить');
    expect(html).toContain('disabled');
    expect(html).toContain('Войти через VK');
  });
});
