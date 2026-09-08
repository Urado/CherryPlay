/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConsentInput } from '../../constants/legalDocuments';
import type { AuthService } from '../../types/auth';

import { EmailAuthForm } from './EmailAuthForm';

function createAuthService(register = vi.fn()): AuthService {
  return {
    login: vi.fn(),
    register,
  };
}

describe('EmailAuthForm register consent gate (interaction)', () => {
  afterEach(() => {
    cleanup();
  });

  it('enables submit after both consents and registers with consent payload', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const authService = createAuthService(register);
    const onSuccess = vi.fn();

    render(
      <EmailAuthForm
        mode="register"
        authService={authService}
        showModeToggle={false}
        onSuccess={onSuccess}
      />,
    );

    const submit = screen.getByRole('button', { name: 'Зарегистрироваться' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText('Отметьте оба согласия, чтобы продолжить')).toBeTruthy();
    expect(submit.getAttribute('aria-describedby')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Название организации'), {
      target: { value: 'Org Name' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'org@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'password1' },
    });
    fireEvent.change(screen.getByLabelText('Подтвердите пароль'), {
      target: { value: 'password1' },
    });

    expect(submit.disabled).toBe(true);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    fireEvent.click(checkboxes[0]!);
    expect(submit.disabled).toBe(true);
    fireEvent.click(checkboxes[1]!);

    await waitFor(() => {
      expect(submit.disabled).toBe(false);
    });
    expect(screen.queryByText('Отметьте оба согласия, чтобы продолжить')).toBeNull();
    expect(submit.getAttribute('aria-describedby')).toBeNull();

    fireEvent.click(submit);

    await waitFor(() => {
      expect(register).toHaveBeenCalledTimes(1);
    });

    const [, , name, consents] = register.mock.calls[0] as [string, string, string, ConsentInput[]];
    expect(name).toBe('Org Name');
    expect(consents).toHaveLength(2);
    expect(consents.every((c) => c.decision === 'grant')).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });
});
