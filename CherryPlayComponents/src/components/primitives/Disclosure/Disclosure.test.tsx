import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Disclosure } from './Disclosure';

describe('Disclosure', () => {
  it('renders collapsed by default with aria attributes', () => {
    const html = renderToStaticMarkup(
      <Disclosure title="Section title" summary="Collapsed summary">
        Panel content
      </Disclosure>,
    );
    expect(html).toContain('cp-disclosure--flat');
    expect(html).toContain('cp-disclosure--collapsed');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls');
    expect(html).toContain('Collapsed summary');
    expect(html).toContain('Panel content');
    expect(html).toContain('hidden');
    expect(html).toContain('aria-hidden="true"');
  });

  it('mounts panel when defaultExpanded is true', () => {
    const html = renderToStaticMarkup(
      <Disclosure title="Open section" defaultExpanded variant="card">
        Visible panel
      </Disclosure>,
    );
    expect(html).toContain('cp-disclosure--card');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Visible panel');
    expect(html).toContain('role="region"');
  });

  it('renders expanded chevron when open', () => {
    const html = renderToStaticMarkup(
      <Disclosure title="Toggle" defaultExpanded>
        Body
      </Disclosure>,
    );
    expect(html).toContain('▾');
  });
});
