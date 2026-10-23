// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminOrganizerListResponse } from '../../types/api';

import { AdminOrganizersPage } from './AdminOrganizersPage';

const apiMocks = vi.hoisted(() => ({
  getOrganizers:
    vi.fn<
      (params: {
        query?: string;
        page?: number;
        pageSize?: number;
      }) => Promise<AdminOrganizerListResponse>
    >(),
}));

vi.mock('../../hooks/useRequireAdmin', () => ({
  useRequireAdmin: () => ({ checking: false, isAdmin: true }),
}));

vi.mock('../../services/adminApiService', () => ({ adminApiService: apiMocks }));

const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="Текущий адрес">{`${location.pathname}${location.search}`}</output>;
};

const createResponse = (page: number, total: number, name: string): AdminOrganizerListResponse => ({
  items: [
    {
      id: `${name}-${page}`,
      name,
      role: 'organizer',
      activeEntitlementsCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
  total,
  page,
  pageSize: 20,
});

const renderPage = (initialEntry = '/admin/organizers') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
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

describe('AdminOrganizersPage pagination behavior', () => {
  beforeEach(() => {
    apiMocks.getOrganizers.mockReset();
    apiMocks.getOrganizers.mockImplementation(({ page = 1 }) =>
      Promise.resolve(createResponse(page, 65, `Организатор ${page}`)),
    );
  });

  it('shows direct page-number controls for the first, middle, and last pages', async () => {
    renderPage();

    await screen.findByText('Организатор 1');

    expect(document.body.contains(screen.getByRole('button', { name: '1' }))).toBe(true);
    expect(document.body.contains(screen.getByRole('button', { name: '2' }))).toBe(true);
    expect(document.body.contains(screen.getByRole('button', { name: '4' }))).toBe(true);
  });

  it('loads the selected page number and updates the URL', async () => {
    renderPage();

    await screen.findByText('Организатор 1');
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() =>
      expect(apiMocks.getOrganizers).toHaveBeenLastCalledWith({
        query: '',
        page: 2,
        pageSize: 20,
      }),
    );
    expect(screen.getByLabelText('Текущий адрес').textContent).toContain('?page=2');
  });

  it('writes the selected page to the URL and restores page and query from the URL', async () => {
    renderPage('/admin/organizers?query=Ирина&page=2');

    await waitFor(() => {
      expect(apiMocks.getOrganizers).toHaveBeenCalledWith({
        query: 'Ирина',
        page: 2,
        pageSize: 20,
      });
    });
    const searchInput = screen.getByRole('searchbox', { name: 'Поиск организаторов' });
    expect(searchInput instanceof HTMLInputElement).toBe(true);
    if (searchInput instanceof HTMLInputElement) expect(searchInput.value).toBe('Ирина');
    expect(screen.getByLabelText('Текущий адрес').textContent).toContain(
      '/admin/organizers?query=Ирина&page=2',
    );
  });

  it('resets pagination to the first page when the search filter changes', async () => {
    renderPage();

    await screen.findByText('Организатор 1');
    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await waitFor(() =>
      expect(apiMocks.getOrganizers).toHaveBeenLastCalledWith({
        query: '',
        page: 2,
        pageSize: 20,
      }),
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск организаторов' }), {
      target: { value: 'Ирина' },
    });

    await waitFor(
      () =>
        expect(apiMocks.getOrganizers).toHaveBeenLastCalledWith({
          query: 'Ирина',
          page: 1,
          pageSize: 20,
        }),
      { timeout: 2000 },
    );
  });

  it('ignores an older response when a newer search has completed', async () => {
    const pageOne = deferred<AdminOrganizerListResponse>();
    const pageTwo = deferred<AdminOrganizerListResponse>();
    const filtered = deferred<AdminOrganizerListResponse>();
    apiMocks.getOrganizers
      .mockImplementationOnce(() => pageOne.promise)
      .mockImplementationOnce(() => pageTwo.promise)
      .mockImplementationOnce(() => filtered.promise);

    renderPage();
    await waitFor(() => expect(apiMocks.getOrganizers).toHaveBeenCalledTimes(1));
    pageOne.resolve(createResponse(1, 65, 'Первая страница'));
    await screen.findByText('Первая страница');

    fireEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await waitFor(() => expect(apiMocks.getOrganizers).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск организаторов' }), {
      target: { value: 'Ирина' },
    });
    await waitFor(() => expect(apiMocks.getOrganizers).toHaveBeenCalledTimes(3), {
      timeout: 2000,
    });

    filtered.resolve(createResponse(1, 1, 'Новый результат'));
    await screen.findByText('Новый результат');
    pageTwo.resolve(createResponse(2, 65, 'Устаревший результат'));

    await waitFor(() => expect(screen.queryByText('Устаревший результат')).toBeNull());
    expect(document.body.contains(screen.getByText('Новый результат'))).toBe(true);
  });
});
