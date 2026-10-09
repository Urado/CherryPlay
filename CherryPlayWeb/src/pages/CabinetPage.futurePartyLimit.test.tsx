import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FuturePartyLimitReachedError } from '../services/partyApiErrors';
import type { PartyDto } from '../types/api';

import { CabinetPage } from './CabinetPage';

const FUTURE_PARTY_LIMIT_MESSAGE =
  'Достигнут лимит: не больше 2 будущих вечеринок. Новую будущую вечеринку создать нельзя, и прошедшую нельзя перенести в будущее.';

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  logout: vi.fn(),
  ensureConsents: vi.fn(),
  getMyParties: vi.fn(),
  listConsentEvents: vi.fn(),
  deleteParty: vi.fn(),
  createParty: vi.fn(),
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
    createParty: mocks.createParty,
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
  name: 'Прошедшая вечеринка',
  shortCode: 'party-one',
  partyThemeId: 'default',
  createdAt: '2026-01-01T00:00:00Z',
  hasActiveSession: false,
  partyLifecycleState: 'ready',
  isListedInCatalog: false,
  eventDateTime: '2020-01-01T18:00:00Z',
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

describe('CabinetPage future party limit', () => {
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
    mocks.createParty.mockRejectedValue(
      new FuturePartyLimitReachedError(FUTURE_PARTY_LIMIT_MESSAGE, 2),
    );
    mocks.updatePartyMetadata.mockRejectedValue(
      new FuturePartyLimitReachedError(FUTURE_PARTY_LIMIT_MESSAGE, 2),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the future party limit on create', async () => {
    renderCabinet();

    fireEvent.click(await screen.findByRole('button', { name: 'Создать вечеринку' }));
    fireEvent.change(screen.getByLabelText('Название *'), { target: { value: 'Ещё одна' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    expect((await screen.findByRole('alert')).textContent).toBe(FUTURE_PARTY_LIMIT_MESSAGE);
    await waitFor(() => expect(mocks.createParty).toHaveBeenCalled());
  });

  it('shows the future party limit when saving a new event date', async () => {
    mocks.getMyParties.mockResolvedValue([party()]);
    renderCabinet();

    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать' }));
    fireEvent.change(screen.getByLabelText('Дата мероприятия (по местному времени выбранной таймзоны)'), {
      target: { value: '2026-12-01T18:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect((await screen.findByRole('alert')).textContent).toBe(FUTURE_PARTY_LIMIT_MESSAGE);
    await waitFor(() => expect(mocks.updatePartyMetadata).toHaveBeenCalled());
  });
});
