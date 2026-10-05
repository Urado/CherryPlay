/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CookieNotice } from '../components/CookieNotice';
import { resetConsentGateNotifier } from '../utils/consentGateNotifier';

import { ConsentGateProvider, useConsentGate, useConsentGateOpen } from './ConsentGateContext';

const createConsentEventsMock = vi.fn();
const listConsentEventsMock = vi.fn();
const logoutMock = vi.fn();

vi.mock('../services/consentEventsService', async () => {
  const actual = await vi.importActual<typeof import('../services/consentEventsService')>(
    '../services/consentEventsService',
  );
  return {
    ...actual,
    createConsentEvents: (...args: unknown[]) => createConsentEventsMock(...args),
    listConsentEvents: (...args: unknown[]) => listConsentEventsMock(...args),
  };
});

vi.mock('../services/authService', () => ({
  authService: {
    logout: (...args: unknown[]) => logoutMock(...args),
  },
}));

vi.mock('@cherryplay/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cherryplay/components')>();
  return {
    ...actual,
    LegalConsentBlock: ({
      pdConsentAccepted,
      termsAccepted,
      onPdConsentChange,
      onTermsChange,
      disabled,
    }: {
      pdConsentAccepted: boolean;
      termsAccepted: boolean;
      onPdConsentChange: (v: boolean) => void;
      onTermsChange: (v: boolean) => void;
      disabled?: boolean;
    }) =>
      createElement(
        'div',
        { role: 'group', 'aria-label': 'Юридические согласия' },
        createElement('input', {
          type: 'checkbox',
          checked: termsAccepted,
          disabled,
          'aria-label': 'Я принимаю условия Пользовательского соглашения',
          onChange: (e: { target: { checked: boolean } }) => onTermsChange(e.target.checked),
        }),
        createElement('input', {
          type: 'checkbox',
          checked: pdConsentAccepted,
          disabled,
          'aria-label':
            'Я даю согласие на обработку персональных данных в соответствии с текстом согласия',
          onChange: (e: { target: { checked: boolean } }) => onPdConsentChange(e.target.checked),
        }),
      ),
  };
});

const GateControls = () => {
  const { openWithMissing } = useConsentGate();
  return (
    <button type="button" onClick={() => openWithMissing()}>
      Open gate
    </button>
  );
};

const OpenWithUnknownMissing = () => {
  const { openWithMissing } = useConsentGate();
  return (
    <button type="button" onClick={() => openWithMissing(['ffffffff-ffff-ffff-ffff-ffffffffffff'])}>
      Open unknown
    </button>
  );
};

const CookieWithGateFlag = () => {
  const open = useConsentGateOpen();
  return open ? null : <CookieNotice />;
};

function renderGateApp() {
  return render(
    <MemoryRouter>
      <ConsentGateProvider>
        <GateControls />
        <CookieWithGateFlag />
      </ConsentGateProvider>
    </MemoryRouter>,
  );
}

const EnsureConsentsButton = () => {
  const { ensureConsents } = useConsentGate();
  const [result, setResult] = useState<string>('pending');
  return (
    <button
      type="button"
      onClick={() => {
        void ensureConsents().then((value) => setResult(value));
      }}
    >
      Ensure
      <span data-testid="ensure-result">{result}</span>
    </button>
  );
};

describe('ConsentGateProvider', () => {
  beforeEach(() => {
    resetConsentGateNotifier();
    createConsentEventsMock.mockReset();
    listConsentEventsMock.mockReset();
    logoutMock.mockReset();
    localStorage.clear();
    document.body.className = '';
  });

  afterEach(() => {
    cleanup();
    resetConsentGateNotifier();
    localStorage.clear();
    document.body.className = '';
  });

  it('ensureConsents waits until Continue grants before resolving ok', async () => {
    listConsentEventsMock.mockResolvedValueOnce([]);
    createConsentEventsMock.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <ConsentGateProvider>
          <EnsureConsentsButton />
        </ConsentGateProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Ensure/ }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Подтвердите согласия' })).toBeTruthy();
    });
    expect(screen.getByTestId('ensure-result').textContent).toBe('pending');

    fireEvent.click(screen.getByRole('checkbox', { name: /Пользовательского соглашения/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /текстом согласия/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));

    await waitFor(() => {
      expect(screen.getByTestId('ensure-result').textContent).toBe('ok');
    });
  });

  it('keeps Continue disabled until both consents are checked', () => {
    renderGateApp();
    fireEvent.click(screen.getByRole('button', { name: 'Open gate' }));

    const continueBtn = screen.getByRole('button', { name: 'Продолжить' });
    expect(continueBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: /Пользовательского соглашения/i }));
    expect(continueBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: /текстом согласия/i }));
    expect(continueBtn.hasAttribute('disabled')).toBe(false);
  });

  it('focuses first consent checkbox on open, not disabled Continue', () => {
    renderGateApp();
    fireEvent.click(screen.getByRole('button', { name: 'Open gate' }));

    const firstCheckbox = screen.getByRole('checkbox', {
      name: /Пользовательского соглашения/i,
    });
    expect(document.activeElement).toBe(firstCheckbox);
    expect(screen.getByRole('button', { name: 'Продолжить' })).not.toBe(document.activeElement);
  });

  it('shows refresh CTA when missing versions are unknown to client', async () => {
    render(
      <MemoryRouter>
        <ConsentGateProvider>
          <OpenWithUnknownMissing />
        </ConsentGateProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open unknown' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Пользовательского соглашения/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /текстом согласия/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Обновите страницу/i);
    });
    expect(createConsentEventsMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Обновить страницу' })).toBeTruthy();
  });

  it('posts consents on Continue', async () => {
    createConsentEventsMock.mockResolvedValueOnce([]);
    renderGateApp();
    fireEvent.click(screen.getByRole('button', { name: 'Open gate' }));

    fireEvent.click(screen.getByRole('checkbox', { name: /Пользовательского соглашения/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /текстом согласия/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));

    await waitFor(() => {
      expect(createConsentEventsMock).toHaveBeenCalledTimes(1);
    });

    const posted = createConsentEventsMock.mock.calls[0]?.[0] as Array<{
      legalDocumentVersionId: string;
      decision: string;
    }>;
    expect(posted).toHaveLength(2);
    expect(posted.every((item) => item.decision === 'grant')).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Подтвердите согласия' })).toBeNull();
  });

  it('logs out from secondary action', async () => {
    logoutMock.mockResolvedValueOnce(undefined);
    renderGateApp();
    fireEvent.click(screen.getByRole('button', { name: 'Open gate' }));

    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('dialog', { name: 'Подтвердите согласия' })).toBeNull();
  });

  it('hides CookieNotice while gate is open', () => {
    renderGateApp();

    expect(screen.getByRole('region', { name: 'Уведомление о cookie' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open gate' }));

    expect(screen.queryByRole('region', { name: 'Уведомление о cookie' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Подтвердите согласия' })).toBeTruthy();
  });
});
