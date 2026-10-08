import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CabinetPage } from './CabinetPage';

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  logout: vi.fn(),
  ensureConsents: vi.fn(),
  getMyParties: vi.fn(),
  listConsentEvents: vi.fn(),
}));

vi.mock('../services/authService', () => ({
  authService: { checkAuth: mocks.checkAuth, logout: mocks.logout },
}));

vi.mock('../services/partyApiService', () => ({
  partyApiService: { getMyParties: mocks.getMyParties },
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
  return {
    ...actual,
    ChangePasswordForm: () => React.createElement('div'),
    Button: React.forwardRef<
      HTMLButtonElement,
      { children?: React.ReactNode; onClick?: () => void; className?: string; type?: string }
    >(({ children, onClick, className, type }, ref) =>
      React.createElement('button', { onClick, className, type, ref }, children),
    ),
  };
});

describe('CabinetPage section tabs', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('links tabs to panels and supports arrow key navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/cabinet']}>
        <Routes>
          <Route path="/cabinet" element={<CabinetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const partiesTab = await screen.findByRole('tab', { name: /Вечеринки/ });
    const accountTab = screen.getByRole('tab', { name: 'Аккаунт' });
    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    const partiesPanel = panels.find((panel) => panel.id === 'cabinet-parties-panel');
    const accountPanel = panels.find((panel) => panel.id === 'account');

    expect(partiesPanel).toBeTruthy();
    expect(accountPanel).toBeTruthy();
    expect(partiesTab.getAttribute('aria-controls')).toBe(partiesPanel?.id);
    expect(accountTab.getAttribute('aria-controls')).toBe(accountPanel?.id);
    expect(partiesPanel?.getAttribute('aria-labelledby')).toBe(partiesTab.id);
    expect(accountPanel?.getAttribute('aria-labelledby')).toBe(accountTab.id);
    expect(partiesTab.getAttribute('aria-selected')).toBe('true');
    expect(accountTab.getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(partiesTab, { key: 'ArrowRight' });

    await waitFor(() => expect(accountTab.getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(accountTab);
    expect(partiesPanel?.hasAttribute('hidden')).toBe(true);
    expect(accountPanel?.hasAttribute('hidden')).toBe(false);
  });
});
