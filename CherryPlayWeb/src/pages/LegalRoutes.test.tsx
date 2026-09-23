/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { ROUTES } from '../constants/routes';

import { LegalDocumentPage } from './LegalDocumentPage';
import { LegalOperatorPage } from './LegalOperatorPage';

function renderPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.PRIVACY} element={<LegalDocumentPage docKey="privacy" />} />
        <Route path="/privacy/v/:version" element={<LegalDocumentPage docKey="privacy" />} />
        <Route path={ROUTES.CONSENT} element={<LegalDocumentPage docKey="consent" />} />
        <Route path="/consent/v/:version" element={<LegalDocumentPage docKey="consent" />} />
        <Route path={ROUTES.TERMS} element={<LegalDocumentPage docKey="terms" />} />
        <Route path="/terms/v/:version" element={<LegalDocumentPage docKey="terms" />} />
        <Route path={ROUTES.COOKIES} element={<LegalDocumentPage docKey="cookies" />} />
        <Route path="/cookies/v/:version" element={<LegalDocumentPage docKey="cookies" />} />
        <Route path={ROUTES.LEGAL} element={<LegalOperatorPage />} />
        <Route path="/" element={<div data-testid="home">home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('legal routes', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders privacy, consent, terms, cookies, legal', () => {
    renderPath(ROUTES.PRIVACY);
    expect(screen.getByRole('heading', { name: /Политика обработки/i })).toBeTruthy();
    cleanup();

    renderPath(ROUTES.CONSENT);
    expect(screen.getByRole('heading', { name: /Согласие на обработку/i })).toBeTruthy();
    cleanup();

    renderPath(ROUTES.TERMS);
    expect(screen.getByRole('heading', { name: /Пользовательское соглашение/i })).toBeTruthy();
    cleanup();

    renderPath(ROUTES.COOKIES);
    expect(screen.getByRole('heading', { name: /cookie/i })).toBeTruthy();
    cleanup();

    renderPath(ROUTES.LEGAL);
    expect(screen.getByRole('heading', { name: /Реквизиты/i })).toBeTruthy();
  });

  it('renders archive version URL', () => {
    renderPath(ROUTES.CONSENT_ARCHIVE('1.0'));
    expect(screen.getByText(/· архив ·/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Согласие на обработку/i })).toBeTruthy();
  });

  it('unknown archive version redirects home', () => {
    renderPath(ROUTES.PRIVACY_ARCHIVE('9.9'));
    expect(screen.getByTestId('home')).toBeTruthy();
  });
});
