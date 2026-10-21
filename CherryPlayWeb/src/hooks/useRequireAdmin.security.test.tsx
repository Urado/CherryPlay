// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRequireAdmin } from './useRequireAdmin';

const authMocks = vi.hoisted(() => ({
  checkAuth: vi.fn<() => Promise<unknown>>(),
}));

const consentMocks = vi.hoisted(() => ({
  ensureConsents: vi.fn<() => Promise<void>>(),
}));

vi.mock('../services/authService', () => ({ authService: authMocks }));

vi.mock('../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({ ensureConsents: consentMocks.ensureConsents }),
}));

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output aria-label="Текущий адрес">
      {`${location.pathname}${location.search}${location.state ? JSON.stringify(location.state) : ''}`}
    </output>
  );
};

const AdminGateProbe = () => {
  const { checking, isAdmin } = useRequireAdmin();
  if (checking) return <p>Проверка</p>;
  return <p>{isAdmin ? 'Администратор' : 'Доступ закрыт'}</p>;
};

const renderGate = () =>
  render(
    <MemoryRouter initialEntries={['/admin/parties']}>
      <Routes>
        <Route
          path="/admin/parties"
          element={
            <>
              <AdminGateProbe />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/login"
          element={
            <>
              <p>Вход</p>
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/cabinet"
          element={
            <>
              <p>Кабинет</p>
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

describe('useRequireAdmin access checks', () => {
  beforeEach(() => {
    authMocks.checkAuth.mockReset();
    consentMocks.ensureConsents.mockReset().mockResolvedValue(undefined);
  });

  it('sends a guest to login without loading protected data', async () => {
    authMocks.checkAuth.mockResolvedValue(null);

    renderGate();

    expect(document.body.contains(await screen.findByText('Вход'))).toBe(true);
    expect(consentMocks.ensureConsents).not.toHaveBeenCalled();
  });

  it.each([
    ['organizer', { id: 'organizer-1', role: 'organizer' }],
    ['missing role', { id: 'organizer-2' }],
  ])('sends an authenticated %s to the cabinet', async (_description, organizer) => {
    authMocks.checkAuth.mockResolvedValue(organizer);

    renderGate();

    expect(document.body.contains(await screen.findByText('Кабинет'))).toBe(true);
    expect(screen.getByLabelText('Текущий адрес').textContent).toContain(
      '/cabinet{"deniedToast":"Доступ запрещен: нужен администратор."}',
    );
    expect(consentMocks.ensureConsents).not.toHaveBeenCalled();
  });

  it('accepts the server-verified admin role and completes the consent check', async () => {
    authMocks.checkAuth.mockResolvedValue({ id: 'admin-1', role: 'admin' });

    renderGate();

    expect(document.body.contains(await screen.findByText('Администратор'))).toBe(true);
    await waitFor(() => expect(consentMocks.ensureConsents).toHaveBeenCalledTimes(1));
  });

  it('fails closed when the authentication check rejects', async () => {
    authMocks.checkAuth.mockRejectedValue(new Error('session store unavailable'));

    renderGate();

    expect(document.body.contains(await screen.findByText('Вход'))).toBe(true);
    expect(consentMocks.ensureConsents).not.toHaveBeenCalled();
  });

  it('does not authorize or open consent after the protected page unmounts', async () => {
    const auth = deferred<unknown>();
    authMocks.checkAuth.mockReturnValue(auth.promise);
    const view = renderGate();

    await waitFor(() => expect(authMocks.checkAuth).toHaveBeenCalledTimes(1));
    view.unmount();
    auth.resolve({ id: 'admin-1', role: 'admin' });
    await auth.promise;
    await Promise.resolve();

    expect(consentMocks.ensureConsents).not.toHaveBeenCalled();
  });
});
