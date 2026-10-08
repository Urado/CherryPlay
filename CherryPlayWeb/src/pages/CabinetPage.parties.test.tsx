import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartyDto } from '../types/api';

import { CabinetPage } from './CabinetPage';

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  logout: vi.fn(),
  ensureConsents: vi.fn(),
  getMyParties: vi.fn(),
  listConsentEvents: vi.fn(),
  deleteParty: vi.fn(),
  updatePartyMetadata: vi.fn(),
  transitionPartyLifecycle: vi.fn(),
}));

vi.mock('../services/authService', () => ({
  authService: { checkAuth: mocks.checkAuth, logout: mocks.logout },
}));

vi.mock('../services/partyApiService', () => ({
  partyApiService: {
    getMyParties: mocks.getMyParties,
    deleteParty: mocks.deleteParty,
    updatePartyMetadata: mocks.updatePartyMetadata,
    transitionPartyLifecycle: mocks.transitionPartyLifecycle,
  },
}));

vi.mock('../services/consentEventsService', async () => {
  const actual = await vi.importActual<typeof import('../services/consentEventsService')>(
    '../services/consentEventsService',
  );
  return { ...actual, listConsentEvents: mocks.listConsentEvents };
});

vi.mock('../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({ ensureConsents: mocks.ensureConsents }),
}));

vi.mock('../hooks/useThemeAccess', () => ({
  useThemeAccess: () => ({ data: null, error: null }),
  clearThemeAccessCache: vi.fn(),
}));

vi.mock('@cherryplay/components', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<typeof import('@cherryplay/components')>();
  const ButtonMock = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      loading?: boolean;
      loadingLabel?: string;
      variant?: string;
      size?: string;
      fullWidth?: boolean;
    }
  >(({ children, loading, loadingLabel, variant, size, fullWidth, ...props }, ref) =>
    React.createElement(
      'button',
      {
        ...props,
        ref,
        'aria-label': loading ? loadingLabel : props['aria-label'],
        'data-variant': variant,
        'data-size': size,
        'data-full-width': fullWidth ? 'true' : undefined,
      },
      children,
    ),
  );
  ButtonMock.displayName = 'ButtonMock';

  return {
    ...actual,
    ChangePasswordForm: () => React.createElement('div'),
    Button: ButtonMock,
  };
});

const party = (overrides: Partial<PartyDto> = {}): PartyDto => ({
  id: 'party-1',
  name: 'Вечеринка для теста',
  shortCode: 'party-one',
  partyThemeId: 'default',
  createdAt: '2026-01-01T00:00:00Z',
  hasActiveSession: false,
  partyLifecycleState: 'ready',
  isListedInCatalog: false,
  ...overrides,
});

const renderCabinet = () =>
  render(
    <MemoryRouter initialEntries={['/cabinet']}>
      <Routes>
        <Route path="/cabinet" element={<CabinetPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('CabinetPage parties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuth.mockResolvedValue({
      id: 'organizer-1',
      name: 'Organizer',
      createdAt: '2024-01-01T00:00:00Z',
      logoUrl: null,
    });
    mocks.logout.mockResolvedValue(undefined);
    mocks.ensureConsents.mockResolvedValue('ok');
    mocks.getMyParties.mockResolvedValue([]);
    mocks.listConsentEvents.mockResolvedValue([]);
    mocks.deleteParty.mockResolvedValue(undefined);
    mocks.updatePartyMetadata.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removes a deleted draft from the cabinet immediately after the server confirms deletion', async () => {
    const draft = party({ partyLifecycleState: 'draft' });
    mocks.getMyParties.mockResolvedValueOnce([draft]).mockResolvedValueOnce([]);

    renderCabinet();

    fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
    expect(screen.getByRole('button', { name: 'Да' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Нет' })).toBeTruthy();
    expect(mocks.deleteParty).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Да' }));

    await waitFor(() => expect(mocks.deleteParty).toHaveBeenCalledWith(draft.id));
    await waitFor(() => expect(mocks.getMyParties).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(draft.name)).toBeNull();
  });

  it('keeps the party visible and reports an error when deletion fails', async () => {
    const existingParty = party();
    mocks.getMyParties.mockResolvedValue([existingParty]);
    mocks.deleteParty.mockRejectedValue(new Error('Ошибка удаления'));

    renderCabinet();

    fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Да' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Ошибка удаления');
    expect(screen.getByText(existingParty.name)).toBeTruthy();
    expect(mocks.getMyParties).toHaveBeenCalledTimes(1);
  });

  it('cancels the inline delete confirmation without calling the API', async () => {
    const existingParty = party();
    mocks.getMyParties.mockResolvedValue([existingParty]);

    renderCabinet();

    fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Нет' }));

    expect(mocks.deleteParty).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeTruthy();
  });

  it('updates the lifecycle status after a successful transition', async () => {
    const draft = party({ partyLifecycleState: 'draft' });
    mocks.getMyParties.mockResolvedValue([draft]);
    mocks.transitionPartyLifecycle.mockResolvedValue({
      ...draft,
      partyLifecycleState: 'ready',
    });

    renderCabinet();

    fireEvent.click(await screen.findByRole('button', { name: 'Сделать доступной' }));

    await waitFor(() =>
      expect(mocks.transitionPartyLifecycle).toHaveBeenCalledWith(draft.id, 'ready'),
    );
    expect(await screen.findByText('Ждёт начала')).toBeTruthy();
  });

  it('refreshes catalog visibility after a successful toggle', async () => {
    const existingParty = party();
    mocks.getMyParties.mockResolvedValueOnce([existingParty]).mockResolvedValueOnce([
      { ...existingParty, isListedInCatalog: true },
    ]);

    renderCabinet();

    fireEvent.click(await screen.findByRole('checkbox', { name: 'В каталоге' }));

    await waitFor(() =>
      expect(mocks.updatePartyMetadata).toHaveBeenCalledWith(existingParty.id, {
        isListedInCatalog: true,
      }),
    );
    await waitFor(() => expect(mocks.getMyParties).toHaveBeenCalledTimes(2));
    expect(
      (screen.getByRole('checkbox', { name: 'В каталоге' })).checked,
    ).toBe(true);
  });
});
