// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import type {
  AdminOrganizerListItemDto,
  AdminPartyDetailDto,
  AdminPartyMutationDto,
} from '../../types/api';

interface AdminParty {
  id: string;
  name: string;
  shortCode: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string | null;
  isOrganizerDeleted: boolean;
  city: string | null;
  eventDateTime: string | null;
  partyLifecycleState: 'draft' | 'ready' | 'completed';
  isListedInCatalog: boolean;
  hasActiveSession: boolean;
  isOrganizerConnected: boolean;
  isDeleted: boolean;
}

interface PartyQuery {
  organizerId?: string;
  query?: string;
  city?: string;
  partyLifecycleState?: 'draft' | 'ready' | 'completed';
  isListedInCatalog?: boolean;
  isDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

interface AdminPartyListResponse {
  items: AdminParty[];
  total: number;
  page: number;
  pageSize: number;
}

interface AdminOrganizerListResponse {
  items: AdminOrganizerListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

const apiMocks = vi.hoisted(() => ({
  getParties: vi.fn<(query: PartyQuery) => Promise<AdminPartyListResponse>>(),
  getOrganizers: vi.fn<() => Promise<AdminOrganizerListResponse>>(),
  getOrganizerById: vi.fn<(organizerId: string) => Promise<AdminOrganizerListItemDto>>(),
  getPartyById: vi.fn<(partyId: string) => Promise<AdminPartyDetailDto>>(),
  setPartyLifecycle:
    vi.fn<
      (partyId: string, lifecycleState: AdminParty['partyLifecycleState']) => Promise<AdminPartyMutationDto>
    >(),
  setPartyCatalogVisibility: vi.fn<(partyId: string, isListed: boolean) => Promise<AdminPartyMutationDto>>(),
}));

vi.mock('../../hooks/useRequireAdmin', () => ({
  useRequireAdmin: () => ({ checking: false, isAdmin: true }),
}));

vi.mock('../../services/adminApiService', () => ({ adminApiService: apiMocks }));

vi.mock('../../contexts/AppConfigContext', () => ({
  AppConfigProvider: ({ children }: { children: ReactNode }) => children,
  useAppConfig: () => ({ partyInfoPageEnabled: true, isLoading: false }),
}));

vi.mock('../../contexts/ConsentGateContext', () => ({
  ConsentGateProvider: ({ children }: { children: ReactNode }) => children,
  useConsentGate: () => ({ ensureConsents: () => Promise.resolve('ok') }),
  useConsentGateOpen: () => false,
}));

vi.mock('../../contexts/SiteAuthContext', () => ({
  SiteAuthProvider: ({ children }: { children: ReactNode }) => children,
  useSiteAuth: () => ({ organizer: null, checked: true }),
}));

vi.mock('../PartyListPage', () => ({
  PartyListPage: () => <h1>Публичный каталог</h1>,
}));

const readyParty: AdminParty = {
  id: 'party-1',
  name: 'Летняя вечеринка',
  shortCode: 'summer-1',
  organizerId: 'organizer-1',
  organizerName: 'Анна Организатор',
  organizerEmail: 'anna@example.test',
  isOrganizerDeleted: false,
  city: 'Казань',
  eventDateTime: '2026-08-20T18:00:00.000Z',
  partyLifecycleState: 'ready',
  isListedInCatalog: true,
  hasActiveSession: false,
  isOrganizerConnected: false,
  isDeleted: false,
};

const toPartyDetail = (party: AdminParty): AdminPartyDetailDto => ({
  ...party,
  partyThemeId: 'basic',
  playlist: { items: [], totalDuration: 0, totalTracks: 0 },
  playbackState: null,
});

const renderAdminParties = () => {
  window.history.pushState({}, '', '/admin/parties');
  return render(<App />);
};

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

const findLifecycleAction = (state: 'draft' | 'ready' | 'completed') => {
  const labels = {
    draft: /сделать черновиком/i,
    ready: /сделать готовой/i,
    completed: /завершить/i,
  };
  return screen.getByRole('button', { name: labels[state] });
};

const openPartyDetail = async (name = 'Летняя вечеринка') => {
  fireEvent.click(await screen.findByRole('link', { name: `Открыть вечеринку ${name}` }));
  await screen.findByRole('heading', { name: 'Карточка вечеринки' });
};

describe('admin parties page behavior', () => {
  beforeEach(() => {
    apiMocks.getParties.mockReset().mockResolvedValue({
      items: [readyParty],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    apiMocks.getPartyById.mockReset().mockResolvedValue(toPartyDetail(readyParty));
    apiMocks.getOrganizers.mockReset().mockResolvedValue({
      items: [
        {
          id: 'organizer-1',
          name: 'Анна Организатор',
          email: 'anna@example.test',
          role: 'organizer',
          activeEntitlementsCount: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    apiMocks.getOrganizerById.mockReset().mockResolvedValue({
      id: 'organizer-1',
      name: 'Анна Организатор',
      email: 'anna@example.test',
      role: 'organizer',
      activeEntitlementsCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    apiMocks.setPartyLifecycle.mockReset().mockResolvedValue(readyParty);
    apiMocks.setPartyCatalogVisibility.mockReset().mockResolvedValue(readyParty);
  });

  it('routes to the unrestricted party list and shows support details in each row', async () => {
    renderAdminParties();

    expect(
      document.body.contains(await screen.findByRole('heading', { name: /админка: вечеринки/i })),
    ).toBe(true);
    expect(apiMocks.getParties).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    const row = screen.getByRole('row', { name: /летняя вечеринка/i });
    expect(document.body.contains(within(row).getByText('summer-1'))).toBe(true);
    expect(document.body.contains(within(row).getByText('Анна Организатор'))).toBe(true);
    expect(document.body.contains(within(row).getByText('Казань'))).toBe(true);
    expect(document.body.contains(within(row).getByText(/готова/i))).toBe(true);
    expect(document.body.contains(within(row).getByText(/в каталоге/i))).toBe(true);
    expect(document.body.contains(within(row).getByRole('link', { name: /открыть вечеринку/i }))).toBe(true);
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('combines organizer, name, city, and lifecycle filters and resets to page one', async () => {
    apiMocks.getParties.mockResolvedValue({
      items: [readyParty],
      total: 65,
      page: 1,
      pageSize: 20,
    });
    renderAdminParties();
    await screen.findByRole('heading', { name: /админка: вечеринки/i });

    fireEvent.click(screen.getByRole('button', { name: /следующая страница/i }));
    await waitFor(() =>
      expect(apiMocks.getParties).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 }),
    );

    fireEvent.change(screen.getByRole('combobox', { name: /организатор/i }), {
      target: { value: 'Анна' },
    });
    expect(apiMocks.getParties.mock.calls.every(([request]) => !request.organizerId)).toBe(true);
    fireEvent.click(await screen.findByRole('option', { name: /Анна Организатор/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /название/i }), {
      target: { value: 'Летняя' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /город/i }), {
      target: { value: 'Казань' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /статус/i }), {
      target: { value: 'ready' },
    });

    await waitFor(
      () =>
        expect(apiMocks.getParties).toHaveBeenLastCalledWith({
        organizerId: 'organizer-1',
        query: 'Летняя',
        city: 'Казань',
        partyLifecycleState: 'ready',
        page: 1,
        pageSize: 20,
        }),
      { timeout: 3000 },
    );
  });

  it('restores a selected organizer label from the URL through the organizer detail API', async () => {
    window.history.pushState({}, '', '/admin/parties?organizerId=organizer-1');
    render(<App />);

    expect(await screen.findByText('Анна Организатор · anna@example.test')).toBeTruthy();
    expect(apiMocks.getOrganizerById).toHaveBeenCalledWith('organizer-1');
    expect(apiMocks.getParties).toHaveBeenCalledWith({ organizerId: 'organizer-1', page: 1, pageSize: 20 });
  });

  it.each([
    ['Черновик', 'draft'],
    ['Готова', 'ready'],
    ['Завершена', 'completed'],
  ] as const)('supports filtering by lifecycle state %s', async (_label, lifecycleState) => {
    renderAdminParties();

    fireEvent.change(await screen.findByRole('combobox', { name: /статус/i }), {
      target: { value: lifecycleState },
    });

    await waitFor(() =>
      expect(apiMocks.getParties).toHaveBeenLastCalledWith({
        partyLifecycleState: lifecycleState,
        page: 1,
        pageSize: 20,
      }),
    );
  });

  it.each([
    ['draft', 'ready'],
    ['draft', 'completed'],
    ['ready', 'draft'],
    ['ready', 'completed'],
    ['completed', 'draft'],
    ['completed', 'ready'],
  ] as const)('allows the administrative lifecycle transition %s to %s', async (from, to) => {
    const party = { ...readyParty, partyLifecycleState: from };
    apiMocks.getParties.mockResolvedValue({ items: [party], total: 1, page: 1, pageSize: 20 });
    apiMocks.getPartyById.mockResolvedValue(toPartyDetail(party));
    renderAdminParties();

    await openPartyDetail();
    fireEvent.click(findLifecycleAction(to));

    await waitFor(() => expect(apiMocks.setPartyLifecycle).toHaveBeenCalledWith('party-1', to));
  });

  it.each([
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ] as const)(
    'blocks lifecycle changes only when session and desktop are both active: %s / %s',
    async (hasActiveSession, isOrganizerConnected, blocked) => {
      apiMocks.getParties.mockResolvedValue({
        items: [{ ...readyParty, hasActiveSession, isOrganizerConnected }],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      apiMocks.getPartyById.mockResolvedValue(
        toPartyDetail({ ...readyParty, hasActiveSession, isOrganizerConnected }),
      );
      renderAdminParties();

      await openPartyDetail();

      const lifecycleAction = findLifecycleAction('draft');
      if (blocked) {
        expect(lifecycleAction.matches(':disabled')).toBe(true);
      } else {
        expect(lifecycleAction.matches(':disabled')).toBe(false);
      }
      expect(screen.getByRole('button', { name: /скрыть из каталога/i }).matches(':disabled')).toBe(
        false,
      );
    },
  );

  it('keeps catalog visibility available during an active connected session', async () => {
    apiMocks.getParties.mockResolvedValue({
      items: [{ ...readyParty, hasActiveSession: true, isOrganizerConnected: true }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    apiMocks.getPartyById.mockResolvedValue(
      toPartyDetail({ ...readyParty, hasActiveSession: true, isOrganizerConnected: true }),
    );
    renderAdminParties();

    await openPartyDetail();
    fireEvent.click(screen.getByRole('button', { name: /скрыть из каталога/i }));

    await waitFor(() =>
      expect(apiMocks.setPartyCatalogVisibility).toHaveBeenCalledWith('party-1', false),
    );
  });

  it('renders deleted parties and organizers as plain text without lifecycle actions', async () => {
    const deletedParty = {
      ...readyParty,
      name: '<img src=x onerror=alert(1)>',
      isOrganizerDeleted: true,
      isDeleted: true,
    };
    apiMocks.getParties.mockResolvedValue({
      items: [deletedParty],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    apiMocks.getPartyById.mockResolvedValue(toPartyDetail(deletedParty));
    renderAdminParties();

    const row = await screen.findByRole('row', { name: /организатор удален/i });
    expect(document.body.contains(within(row).getByText('<img src=x onerror=alert(1)>'))).toBe(
      true,
    );
    expect(within(row).queryByRole('img')).toBeNull();
    expect(within(row).queryByRole('button')).toBeNull();
    await openPartyDetail('<img src=x onerror=alert(1)>');
    expect(screen.getByText('Вечеринка удалена. Доступен только просмотр.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /сделать|завершить|скрыть|вернуть/i })).toBeNull();
  });

  it('does not show a requested lifecycle as saved when the server rejects it', async () => {
    apiMocks.setPartyLifecycle.mockRejectedValue(new Error('Изменение запрещено'));
    renderAdminParties();

    await openPartyDetail();
    fireEvent.click(findLifecycleAction('draft'));

    expect((await screen.findByRole('alert')).textContent).toContain('Изменение запрещено');
    expect(screen.getByText('Состояние: Готова')).toBeTruthy();
  });

  it('restores filters and page from the URL and resets pagination when a filter changes', async () => {
    window.history.pushState({}, '', '/admin/parties?query=Летняя&city=Казань&page=2');
    render(<App />);

    await waitFor(() =>
      expect(apiMocks.getParties).toHaveBeenCalledWith({
        query: 'Летняя',
        city: 'Казань',
        page: 2,
        pageSize: 20,
      }),
    );
    fireEvent.change(screen.getByRole('combobox', { name: /статус/i }), {
      target: { value: 'ready' },
    });

    await waitFor(() =>
      expect(apiMocks.getParties).toHaveBeenLastCalledWith({
        query: 'Летняя',
        city: 'Казань',
        partyLifecycleState: 'ready',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(window.location.search).toContain('partyLifecycleState=ready');
    expect(window.location.search).not.toContain('page=2');
  });

  it('filters by catalog visibility and deletion while leaving both unset by default', async () => {
    renderAdminParties();
    expect(apiMocks.getParties).toHaveBeenCalledWith({ page: 1, pageSize: 20 });

    fireEvent.change(screen.getByRole('combobox', { name: /видимость в каталоге/i }), {
      target: { value: 'false' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /удаление/i }), {
      target: { value: 'true' },
    });

    await waitFor(() =>
      expect(apiMocks.getParties).toHaveBeenLastCalledWith({
        isListedInCatalog: false,
        isDeleted: true,
        page: 1,
        pageSize: 20,
      }),
    );
  });

  it('ignores an older party response after a newer filter request completes', async () => {
    const oldResponse = deferred<AdminPartyListResponse>();
    const newResponse = deferred<AdminPartyListResponse>();
    apiMocks.getParties.mockReset().mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    renderAdminParties();

    await waitFor(() => expect(apiMocks.getParties).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox', { name: /название вечеринки/i }), {
      target: { value: 'Новая' },
    });
    await waitFor(() => expect(apiMocks.getParties).toHaveBeenCalledTimes(2));

    newResponse.resolve({
      items: [{ ...readyParty, id: 'new-party', name: 'Новая вечеринка' }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(document.body.contains(await screen.findByText('Новая вечеринка'))).toBe(true);
    oldResponse.resolve({
      items: [{ ...readyParty, id: 'old-party', name: 'Устаревшая вечеринка' }],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await waitFor(() => expect(screen.queryByText('Устаревшая вечеринка')).toBeNull());
    expect(document.body.contains(screen.getByText('Новая вечеринка'))).toBe(true);
  });
});
