// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from './SiteFooter';

describe('SiteFooter', () => {
  it('renders legal nav with full document link labels', () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Юридические документы' })).toBeTruthy();

    const privacy = screen.getByRole('link', { name: 'Политика персональных данных' });
    expect(privacy.getAttribute('href')).toBe('/privacy');

    const consent = screen.getByRole('link', {
      name: 'Согласие на обработку персональных данных',
    });
    expect(consent.getAttribute('href')).toBe('/consent');

    expect(
      screen.getByRole('link', { name: 'Пользовательское соглашение' }).getAttribute('href'),
    ).toBe('/terms');
    expect(screen.getByRole('link', { name: 'Политика cookie' }).getAttribute('href')).toBe(
      '/cookies',
    );
    expect(screen.getByRole('link', { name: 'Реквизиты' }).getAttribute('href')).toBe('/legal');
  });
});
