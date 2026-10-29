// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminOrganizerListResponse } from '../../types/api';

import { AdminOrganizersPage } from './AdminOrganizersPage';

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn<() => Promise<unknown>>(),
  ensureConsents: vi.fn<() => Promise<void>>(),
  getOrganizers: vi.fn<() => Promise<AdminOrganizerListResponse>>(),
}));

vi.mock('../../services/authService', () => ({ authService: { checkAuth: mocks.checkAuth } }));
vi.mock('../../services/adminApiService', () => ({
  adminApiService: { getOrganizers: mocks.getOrganizers },
}));
vi.mock('../../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({ ensureConsents: mocks.ensureConsents }),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="Текущий адрес">{location.pathname}</output>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/organizers']}>
      <Routes>
        <Route
          path="/admin/organizers"
          element={
            <>
              <AdminOrganizersPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/login" element={<LocationProbe />} />
        <Route path="/cabinet" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe('AdminOrganizersPage authorization boundary', () => {
  beforeEach(() => {
    mocks.checkAuth.mockReset();
    mocks.ensureConsents.mockReset().mockResolvedValue(undefined);
    mocks.getOrganizers.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it.each([
    ['guest', null, '/login'],
    ['non-admin', { id: 'organizer-1', role: 'organizer' }, '/cabinet'],
  ])('does not load protected organizer data for a %s', async (_description, user, destination) => {
    mocks.checkAuth.mockResolvedValue(user);

    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Текущий адрес').textContent).toBe(destination));
    expect(mocks.getOrganizers).not.toHaveBeenCalled();
    expect(mocks.ensureConsents).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Админка: организаторы' })).toBeNull();
  });
});
