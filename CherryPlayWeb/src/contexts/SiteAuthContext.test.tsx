import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SiteHeader } from '../components/SiteHeader';
import { AUTH_STATE_CHANGED_EVENT, authService } from '../services/authService';

import { SiteAuthProvider } from './SiteAuthContext';

describe('SiteAuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshes the header after sign-in and sign-out events', async () => {
    const organizer = {
      id: 'organizer-1',
      name: 'Organizer',
      createdAt: '2024-01-01T00:00:00Z',
      logoUrl: null,
    };
    const checkAuth = vi
      .spyOn(authService, 'checkAuth')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(organizer)
      .mockResolvedValueOnce(null);

    render(
      <MemoryRouter>
        <SiteAuthProvider>
          <SiteHeader />
        </SiteAuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Вход' })).toBeTruthy();
    fireEvent(window, new Event(AUTH_STATE_CHANGED_EVENT));
    expect(await screen.findByRole('link', { name: 'Кабинет' })).toBeTruthy();
    expect(checkAuth).toHaveBeenCalledTimes(2);

    fireEvent(window, new Event(AUTH_STATE_CHANGED_EVENT));
    expect(await screen.findByRole('link', { name: 'Вход' })).toBeTruthy();
    await waitFor(() => expect(checkAuth).toHaveBeenCalledTimes(3));
  });
});
