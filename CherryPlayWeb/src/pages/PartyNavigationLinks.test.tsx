import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { PartyListCardLink } from './PartyListCardLink';
import { PartyViewBackLink } from './PartyViewBackLink';

describe('party navigation links', () => {
  it('renders a native party-card anchor that supports browser new-tab actions', () => {
    const view = renderToStaticMarkup(
      <StaticRouter location="/">
        <PartyListCardLink to="/party/abc" partyName="Летняя вечеринка">
          <h2>Летняя вечеринка</h2>
        </PartyListCardLink>
      </StaticRouter>,
    );

    expect(view).toContain('href="/party/abc"');
    expect(view).toContain('aria-label="Открыть вечеринку: Летняя вечеринка"');
    expect(view).toContain('<h2>Летняя вечеринка</h2>');
    expect(view).not.toContain('target=');
  });

  it('renders the back control as a native link to the party list', () => {
    const view = renderToStaticMarkup(
      <StaticRouter location="/">
        <PartyViewBackLink to="/" />
      </StaticRouter>,
    );

    expect(view).toContain('href="/"');
    expect(view).toContain('class="party-view-back-btn"');
    expect(view).toContain('← Список вечеринок');
  });
});
