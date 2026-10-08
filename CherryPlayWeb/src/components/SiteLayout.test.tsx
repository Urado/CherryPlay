import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authService } from '../services/authService';

import { SiteLayout } from './SiteLayout';

describe('SiteLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the site auth provider mounted while navigating between site routes', async () => {
    const checkAuth = vi.spyOn(authService, 'checkAuth').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<h1>Вечеринки</h1>} />
            <Route path="/download" element={<h1>Скачать приложение</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Вход' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Скачать приложение' }));

    expect(await screen.findByRole('heading', { name: 'Скачать приложение' })).toBeTruthy();
    expect(checkAuth).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Вход' })).toBeTruthy();
  });
});
