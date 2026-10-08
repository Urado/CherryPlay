/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminApiService } from '../../services/adminApiService';
import type { AdminOrganizerDetailDto, EntitlementDto } from '../../types/api';

import { AdminOrganizerDetailPage } from './AdminOrganizerDetailPage';

vi.mock('../../hooks/useRequireAdmin', () => ({
  useRequireAdmin: () => ({ checking: false, isAdmin: true }),
}));

vi.mock('../../services/adminApiService', () => ({
  adminApiService: {
    getOrganizerById: vi.fn(),
    getThemePackages: vi.fn(),
    grantEntitlement: vi.fn(),
    revokeEntitlement: vi.fn(),
  },
}));

const entitlement: EntitlementDto = {
  id: 'entitlement-1',
  packageId: 'package-1',
  packageCode: 'THEME-PACK',
  packageName: 'Набор тем',
  kind: 'theme',
  source: 'admin',
  grantedAt: '2026-01-01T00:00:00.000Z',
  note: null,
};

const organizer: AdminOrganizerDetailDto = {
  id: 'organizer-1',
  name: 'Организатор',
  role: 'organizer',
  createdAt: '2025-01-01T00:00:00.000Z',
  entitlements: [entitlement],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/organizers/organizer-1']}>
      <Routes>
        <Route path="/admin/organizers/:id" element={<AdminOrganizerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openRevocationDialog(actionName = 'Отозвать') {
  await screen.findByRole('heading', { name: 'Карточка организатора' });
  fireEvent.click(screen.getByRole('button', { name: actionName }));
  return screen.findByRole('dialog');
}

function getConfirmButton(dialog: HTMLElement, name = 'Отозвать') {
  return within(dialog).getByRole('button', { name });
}

describe('AdminOrganizerDetailPage revocation request lifecycle', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(adminApiService.getOrganizerById).mockReset().mockResolvedValue(organizer);
    vi.mocked(adminApiService.getThemePackages).mockReset().mockResolvedValue({ items: [] });
    vi.mocked(adminApiService.grantEntitlement).mockReset();
    vi.mocked(adminApiService.revokeEntitlement).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('restores and retries the same pending request after an uncertain result and page return', async () => {
    const revokeEntitlement = vi.mocked(adminApiService.revokeEntitlement);
    revokeEntitlement.mockRejectedValueOnce(new Error('Соединение прервано'));
    revokeEntitlement.mockResolvedValueOnce(undefined);

    const firstPage = renderPage();
    const firstDialog = await openRevocationDialog();
    fireEvent.change(within(firstDialog).getByRole('textbox'), {
      target: { value: 'Проверка отзыва' },
    });
    fireEvent.click(getConfirmButton(firstDialog));
    await within(firstDialog).findByRole('alert');

    const firstRequest = revokeEntitlement.mock.calls[0]?.[0];
    expect(firstRequest).toMatchObject({
      entitlementId: entitlement.id,
      note: 'Проверка отзыва',
    });
    expect(firstRequest?.id).toMatch(/^[0-9a-f-]{36}$/i);

    fireEvent.click(within(firstDialog).getByRole('button', { name: 'Отмена' }));
    firstPage.unmount();
    vi.mocked(adminApiService.getOrganizerById).mockResolvedValue({
      ...organizer,
      entitlements: [{ ...entitlement, revokedAt: '2026-01-02T00:00:00.000Z' }],
    });

    renderPage();
    const returnedDialog = await openRevocationDialog('Повторить отзыв');
    const noteField = within(returnedDialog).getByRole('textbox');
    expect((noteField as HTMLTextAreaElement).value).toBe('Проверка отзыва');
    expect((noteField as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(getConfirmButton(returnedDialog, 'Повторить отзыв'));

    await waitFor(() => expect(revokeEntitlement).toHaveBeenCalledTimes(2));
    expect(revokeEntitlement.mock.calls[1]?.[0]).toEqual(firstRequest);
    await waitFor(() =>
      expect(window.sessionStorage.getItem(`admin-entitlement-revocation:${entitlement.id}`)).toBeNull(),
    );
  });

  it.each([400, 422])('uses a new UUID after a definitive %s rejection', async (status) => {
    const revokeEntitlement = vi.mocked(adminApiService.revokeEntitlement);
    revokeEntitlement.mockRejectedValueOnce(Object.assign(new Error('Проверка запроса не пройдена'), { status }));
    revokeEntitlement.mockResolvedValueOnce(undefined);

    renderPage();
    const dialog = await openRevocationDialog();
    fireEvent.click(getConfirmButton(dialog));
    await within(dialog).findByRole('alert');
    expect(window.sessionStorage.getItem(`admin-entitlement-revocation:${entitlement.id}`)).toBeNull();

    fireEvent.click(getConfirmButton(dialog));
    await waitFor(() => expect(revokeEntitlement).toHaveBeenCalledTimes(2));

    const firstRequest = revokeEntitlement.mock.calls[0]?.[0];
    const retryRequest = revokeEntitlement.mock.calls[1]?.[0];
    expect(firstRequest?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(retryRequest?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(retryRequest?.id).not.toBe(firstRequest?.id);
  });

  it('uses a new UUID when the note changes after a definitive rejection', async () => {
    const generatedIds: `${string}-${string}-${string}-${string}-${string}`[] = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000004',
    ];
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => generatedIds.shift()!);

    const revokeEntitlement = vi.mocked(adminApiService.revokeEntitlement);
    revokeEntitlement.mockRejectedValueOnce(
      Object.assign(new Error('Проверка запроса не пройдена'), { status: 422 }),
    );
    revokeEntitlement.mockResolvedValueOnce(undefined);

    renderPage();
    const dialog = await openRevocationDialog();
    const noteField = within(dialog).getByRole('textbox');
    fireEvent.change(noteField, { target: { value: 'Первая причина' } });
    fireEvent.click(getConfirmButton(dialog));
    await within(dialog).findByRole('alert');

    fireEvent.change(noteField, { target: { value: 'Исправленная причина' } });
    fireEvent.click(getConfirmButton(dialog));
    await waitFor(() => expect(revokeEntitlement).toHaveBeenCalledTimes(2));

    expect(revokeEntitlement.mock.calls[0]?.[0]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000002',
      note: 'Первая причина',
    });
    expect(revokeEntitlement.mock.calls[1]?.[0]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000004',
      note: 'Исправленная причина',
    });
  });
});
