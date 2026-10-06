import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { PartyListCardLink } from './PartyListCardLink';
import { PartyViewBackLink } from './PartyViewBackLink';

describe('party navigation links', () => {
  it('renders a native party-card anchor that supports browser new-tab actions', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <PartyListCardLink to="/party/abc" partyName="Летняя вечеринка">
          <h2>Летняя вечеринка</h2>
        </PartyListCardLink>
      </StaticRouter>,
    );

    expect(html).toContain('href="/party/abc"');
    expect(html).toContain('aria-label="Открыть вечеринку: Летняя вечеринка"');
    expect(html).toContain('<h2>Летняя вечеринка</h2>');
    expect(html).not.toContain('target=');
  });

  it('renders the back control as a native link to the party list', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <PartyViewBackLink to="/" />
      </StaticRouter>,
    );

    expect(html).toContain('href="/"');
    expect(html).toContain('class="party-view-back-btn"');
    expect(html).toContain('← Список вечеринок');
  });
});
