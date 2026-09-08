/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CookieNotice } from './CookieNotice';

const STORAGE_KEY = 'cherryplay.cookie-notice.dismissed';

describe('CookieNotice', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.body.className = '';
  });

  it('renders region landmark and dismisses into localStorage', () => {
    render(
      <MemoryRouter>
        <CookieNotice />
      </MemoryRouter>,
    );

    const region = screen.getByRole('region', { name: 'Уведомление о cookie' });
    expect(region).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Политика cookie' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    expect(screen.queryByRole('region', { name: 'Уведомление о cookie' })).toBeNull();
  });

  it('stays hidden when already dismissed', () => {
    localStorage.setItem(STORAGE_KEY, '1');

    const { container } = render(
      <MemoryRouter>
        <CookieNotice />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
  });
});
