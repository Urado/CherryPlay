import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormSelect } from './FormSelect';

describe('FormSelect', () => {
  it('connects its label and hint to the select', () => {
    const html = renderToStaticMarkup(
      <FormSelect label="Party theme" hint="Choose a theme" name="theme">
        <option value="default">Default</option>
      </FormSelect>,
    );

    expect(html).toContain('for="select-party-theme"');
    expect(html).toContain('id="select-party-theme"');
    expect(html).toContain('aria-describedby="select-party-theme-hint"');
    expect(html).toContain('id="select-party-theme-hint"');
    expect(html).toContain('name="theme"');
  });

  it('associates an error and marks the select invalid', () => {
    const html = renderToStaticMarkup(
      <FormSelect label="Party theme" error="Choose a valid theme" hint="Choose a theme">
        <option value="default">Default</option>
      </FormSelect>,
    );

    expect(html).toContain('aria-describedby="select-party-theme-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="select-party-theme-error"');
    expect(html).not.toContain('id="select-party-theme-hint"');
  });
});
