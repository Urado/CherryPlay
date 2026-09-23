/**
 * @vitest-environment jsdom
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsentGateProvider } from '../contexts/ConsentGateContext';

import { useRequireAdmin } from './useRequireAdmin';

const checkAuthMock = vi.fn();
const ensureConsentsMock = vi.fn();
const ensureConsentsStable = (...args: unknown[]) => ensureConsentsMock(...args);

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: (...args: unknown[]) => checkAuthMock(...args),
  },
}));

vi.mock('../contexts/ConsentGateContext', async () => {
  const actual = await vi.importActual<typeof import('../contexts/ConsentGateContext')>(
    '../contexts/ConsentGateContext',
  );
  return {
    ...actual,
    useConsentGate: () => ({
      isOpen: false,
      ensureConsents: ensureConsentsStable,
      openWithMissing: vi.fn(),
    }),
  };
});

const Probe = ({
  onResult,
}: {
  onResult: (value: { checking: boolean; isAdmin: boolean }) => void;
}) => {
  const value = useRequireAdmin();
  onResult(value);
  return null;
};

describe('useRequireAdmin', () => {
  beforeEach(() => {
    checkAuthMock.mockReset();
    ensureConsentsMock.mockReset();
    ensureConsentsMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('calls ensureConsents after admin auth succeeds', async () => {
    checkAuthMock.mockResolvedValue({
      id: '1',
      name: 'Admin',
      createdAt: '2020-01-01',
      role: 'admin',
    });

    const results: Array<{ checking: boolean; isAdmin: boolean }> = [];
    render(
      <MemoryRouter>
        <ConsentGateProvider>
          <Probe onResult={(value) => results.push(value)} />
        </ConsentGateProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(ensureConsentsMock).toHaveBeenCalledTimes(1);
      expect(results.some((r) => r.isAdmin && !r.checking)).toBe(true);
    });
  });

  it('does not call ensureConsents when user is not admin', async () => {
    checkAuthMock.mockResolvedValue({
      id: '1',
      name: 'Org',
      createdAt: '2020-01-01',
      role: 'organizer',
    });

    render(
      <MemoryRouter initialEntries={['/admin/organizers']}>
        <ConsentGateProvider>
          <Probe onResult={() => undefined} />
        </ConsentGateProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(checkAuthMock).toHaveBeenCalled();
    });
    expect(ensureConsentsMock).not.toHaveBeenCalled();
  });
});
