import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { AuthService } from '../../types/auth';

import { EmailAuthForm } from './EmailAuthForm';

function createAuthService(): AuthService {
  return {
    login: vi.fn(),
    register: vi.fn(),
  };
}

describe('EmailAuthForm register consent gate', () => {
  it('renders LegalConsentBlock and disabled submit in register mode', () => {
    const html = renderToStaticMarkup(
      <EmailAuthForm mode="register" authService={createAuthService()} showModeToggle={false} />,
    );

    expect(html).toContain('legal-consent-block');
    expect(html).toContain('data-legal-consent="pd"');
    expect(html).toContain('data-legal-consent="terms"');
    expect(html).toContain('Зарегистрироваться');
    expect(html).toContain('Отметьте оба согласия, чтобы продолжить');
    expect(html).toMatch(/disabled/);
  });

  it('does not render LegalConsentBlock in login mode', () => {
    const html = renderToStaticMarkup(
      <EmailAuthForm mode="login" authService={createAuthService()} showModeToggle={false} />,
    );

    expect(html).not.toContain('legal-consent-block');
  });
});
