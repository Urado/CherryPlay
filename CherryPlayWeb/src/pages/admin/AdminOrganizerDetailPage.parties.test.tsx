// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminOrganizerDetailDto, ThemePackageListResponse } from '../../types/api';

import { AdminOrganizerDetailPage } from './AdminOrganizerDetailPage';

interface OrganizerParty {
  id: string;
  name: string;
  shortCode: string;
  organizerId: string;
  organizerName: string;
  city: string | null;
  partyLifecycleState: 'draft' | 'ready' | 'completed';
  isListedInCatalog: boolean;
}

const apiMocks = vi.hoisted(() => ({
  getOrganizerById: vi.fn<(organizerId: string) => Promise<AdminOrganizerDetailDto>>(),
  getThemePackages: vi.fn<() => Promise<ThemePackageListResponse>>(),
  getParties: vi.fn<
    (query: { organizerId: string; page: number; pageSize: number }) => Promise<{
      items: OrganizerParty[];
      total: number;
      page: number;
      pageSize: number;
    }>
  >(),
}));

vi.mock('../../hooks/useRequireAdmin', () => ({
  useRequireAdmin: () => ({ checking: false, isAdmin: true }),
}));

vi.mock('../../services/adminApiService', () => ({ adminApiService: apiMocks }));

const organizer: AdminOrganizerDetailDto = {
  id: 'organizer-1',
  name: 'Анна Организатор',
  email: 'anna@example.test',
  role: 'organizer',
  createdAt: '2025-01-01T00:00:00.000Z',
  entitlements: [],
};

const party: OrganizerParty = {
  id: 'party-1',
  name: 'Вечеринка Анны',
  shortCode: 'anna-1',
  organizerId: organizer.id,
  organizerName: organizer.name,
  city: 'Пермь',
  partyLifecycleState: 'draft',
  isListedInCatalog: false,
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/admin/organizers/${organizer.id}`]}>
      <Routes>
        <Route path="/admin/organizers/:id" element={<AdminOrganizerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('AdminOrganizerDetailPage party list', () => {
  beforeEach(() => {
    apiMocks.getOrganizerById.mockReset().mockResolvedValue(organizer);
    apiMocks.getThemePackages.mockReset().mockResolvedValue({ items: [] });
    apiMocks.getParties.mockReset().mockResolvedValue({
      items: [party],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('loads and displays only parties belonging to the organizer', async () => {
    renderPage();

    expect(
      document.body.contains(await screen.findByRole('heading', { name: 'Анна Организатор' })),
    ).toBe(true);
    expect(apiMocks.getParties).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /вечеринки/i }));
    await waitFor(() =>
      expect(apiMocks.getParties).toHaveBeenCalledWith({
        organizerId: organizer.id,
        page: 1,
        pageSize: 20,
      }),
    );
    const partyTable = screen.getByRole('table');
    expect(partyTable.textContent).toContain('Вечеринка Анны');
    expect(partyTable.textContent).toContain('anna-1');
    expect(partyTable.textContent).toContain('Пермь');
    expect(partyTable.textContent).toContain('Черновик');
    expect(partyTable.textContent).toContain('Скрыта из каталога');
  });
});
