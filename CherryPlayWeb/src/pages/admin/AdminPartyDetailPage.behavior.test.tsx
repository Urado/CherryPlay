// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminPartyDetailDto, AdminPartyMutationDto, AdminPartySessionResetDto } from '../../types/api';

import { AdminPartyDetailPage } from './AdminPartyDetailPage';

const apiMocks = vi.hoisted(() => ({
  getPartyById: vi.fn<(partyId: string) => Promise<AdminPartyDetailDto>>(),
  setPartyLifecycle: vi.fn<(partyId: string, state: 'draft' | 'ready' | 'completed') => Promise<AdminPartyMutationDto>>(),
  setPartyCatalogVisibility: vi.fn<(partyId: string, isListed: boolean) => Promise<AdminPartyMutationDto>>(),
  resetPartySession: vi.fn<(partyId: string) => Promise<AdminPartySessionResetDto>>(),
}));

vi.mock('../../hooks/useRequireAdmin', () => ({
  useRequireAdmin: () => ({ checking: false, isAdmin: true }),
}));

vi.mock('../../services/adminApiService', () => ({ adminApiService: apiMocks }));

const readyParty: AdminPartyDetailDto = {
  id: 'party-1',
  organizerId: 'organizer-1',
  organizerName: 'Анна Организатор',
  isOrganizerDeleted: false,
  name: 'Летняя вечеринка',
  title: null,
  shortCode: 'summer-1',
  city: 'Казань',
  eventDateTime: '2026-08-20T18:00:00.000Z',
  partyLifecycleState: 'ready',
  isListedInCatalog: true,
  isDeleted: false,
  hasActiveSession: false,
  isOrganizerConnected: false,
  partyThemeId: 'basic',
  playlist: { items: [], totalDuration: 0, totalTracks: 0 },
  playbackState: null,
};

const playbackState = {
  currentTrackId: 'track-1',
  status: 'playing' as const,
  position: 20,
  duration: 120,
  volume: 0.8,
  mode: 'session' as const,
  playedTrackIds: ['track-1'],
  disabledTrackIds: [],
  disabledGroupIds: [],
  lastUpdatedAt: '2026-08-20T18:00:00.000Z',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/parties/party-1']}>
      <Routes>
        <Route path="/admin/parties/:id" element={<AdminPartyDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

const renderNavigablePage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/parties/party-1']}>
      <Routes>
        <Route path="/admin/parties/:id" element={<AdminPartyDetailPage />} />
        <Route path="/navigate" element={<Link to="/admin/parties/party-2">Открыть вторую</Link>} />
      </Routes>
      <Link to="/navigate">Навигация</Link>
    </MemoryRouter>,
  );

describe('AdminPartyDetailPage behavior', () => {
  beforeEach(() => {
    apiMocks.getPartyById.mockReset().mockResolvedValue(readyParty);
    apiMocks.setPartyLifecycle.mockReset().mockResolvedValue({
      id: readyParty.id,
      partyLifecycleState: 'draft',
      isListedInCatalog: true,
    });
    apiMocks.setPartyCatalogVisibility.mockReset().mockResolvedValue({
      id: readyParty.id,
      partyLifecycleState: 'ready',
      isListedInCatalog: false,
    });
    apiMocks.resetPartySession.mockReset().mockResolvedValue({
      id: readyParty.id,
      wasReset: true,
      hasActiveSession: false,
      isOrganizerConnected: false,
      playbackState: null,
    });
  });

  it('loads the party detail and exposes all lifecycle destinations', async () => {
    renderPage();

    expect(document.body.contains(await screen.findByRole('heading', { name: 'Летняя вечеринка' }))).toBe(true);
    expect(screen.getByRole('button', { name: 'Сделать черновиком' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Завершить' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Сделать готовой' })).toBeNull();
  });

  it('keeps catalog visibility available during an active connected session while blocking lifecycle changes', async () => {
    apiMocks.getPartyById.mockResolvedValue({
      ...readyParty,
      hasActiveSession: true,
      isOrganizerConnected: true,
      playbackState,
    });
    renderPage();

    expect(document.body.contains(await screen.findByText(/сначала завершите эфир или отключите десктоп/i))).toBe(true);
    expect(screen.getByRole('button', { name: 'Сделать черновиком' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /скрыть из каталога/i }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: /сбросить эфир/i }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /скрыть из каталога/i }));
    await waitFor(() => expect(apiMocks.setPartyCatalogVisibility).toHaveBeenCalledWith('party-1', false));
  });

  it('confirms a session reset and reloads the party detail', async () => {
    apiMocks.getPartyById
      .mockResolvedValueOnce({ ...readyParty, hasActiveSession: true, playbackState })
      .mockResolvedValueOnce({ ...readyParty, hasActiveSession: false, playbackState: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /сбросить эфир и воспроизведение/i }));
    expect(document.body.contains(await screen.findByRole('alertdialog'))).toBe(true);
    expect(screen.getByText(/плейлист, название, статус и видимость вечеринки сохранятся/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить эфир' }));

    await waitFor(() => expect(apiMocks.resetPartySession).toHaveBeenCalledWith('party-1'));
    expect(document.body.contains(await screen.findByRole('status'))).toBe(true);
    expect(apiMocks.getPartyById).toHaveBeenCalledTimes(2);
  });

  it('allows resetting stale playback when the session is no longer active', async () => {
    apiMocks.getPartyById.mockResolvedValue({ ...readyParty, hasActiveSession: false, playbackState });
    renderPage();

    const resetButton = await screen.findByRole('button', { name: /сбросить эфир и воспроизведение/i });
    expect(resetButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(resetButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Сбросить эфир' }));

    await waitFor(() => expect(apiMocks.resetPartySession).toHaveBeenCalledWith('party-1'));
  });

  it('allows resetting an active session without saved playback when the desktop is offline', async () => {
    apiMocks.getPartyById
      .mockResolvedValueOnce({ ...readyParty, hasActiveSession: true, isOrganizerConnected: false })
      .mockResolvedValueOnce(readyParty);
    renderPage();

    const resetButton = await screen.findByRole('button', { name: /сбросить эфир и воспроизведение/i });
    expect(resetButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(resetButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Сбросить эфир' }));

    await waitFor(() => expect(apiMocks.resetPartySession).toHaveBeenCalledWith('party-1'));
    expect(apiMocks.getPartyById).toHaveBeenCalledTimes(2);
  });

  it('does not let a pending action for another party replace the current detail', async () => {
    let resolveLifecycle: ((value: AdminPartyMutationDto) => void) | undefined;
    apiMocks.getPartyById
      .mockResolvedValueOnce(readyParty)
      .mockResolvedValueOnce({ ...readyParty, id: 'party-2', name: 'Другая вечеринка' });
    apiMocks.setPartyLifecycle.mockImplementationOnce(
      () => new Promise((resolve) => { resolveLifecycle = resolve; }),
    );
    const view = renderNavigablePage();

    fireEvent.click(await screen.findByRole('button', { name: 'Сделать черновиком' }));
    fireEvent.click(screen.getByRole('link', { name: 'Навигация' }));
    fireEvent.click(screen.getByRole('link', { name: 'Открыть вторую' }));
    expect(document.body.contains(await screen.findByRole('heading', { name: 'Другая вечеринка' }))).toBe(true);

    resolveLifecycle?.({ id: 'party-1', partyLifecycleState: 'draft', isListedInCatalog: true });
    await waitFor(() => expect(screen.queryByText(/состояние изменено/i)).toBeNull());
    expect(screen.getByRole('heading', { name: 'Другая вечеринка' })).toBeTruthy();
    view.unmount();
  });

  it('renders deleted parties read-only with a specific reason', async () => {
    apiMocks.getPartyById.mockResolvedValue({ ...readyParty, isDeleted: true });
    renderPage();

    expect(document.body.contains(await screen.findByText('Изменение состояния, видимости и эфира недоступно для удалённой вечеринки.'))).toBe(true);
    expect(screen.queryByRole('button', { name: /сделать|завершить|скрыть|вернуть|сбросить/i })).toBeNull();
  });

  it('does not display an unsuccessful lifecycle update as saved', async () => {
    apiMocks.setPartyLifecycle.mockRejectedValue(new Error('Изменение запрещено'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Сделать черновиком' }));

    expect(document.body.contains(await screen.findByRole('alert'))).toBe(true);
    expect(screen.getByText('Состояние')).toBeTruthy();
    expect(screen.getByText('Готова')).toBeTruthy();
  });
});
