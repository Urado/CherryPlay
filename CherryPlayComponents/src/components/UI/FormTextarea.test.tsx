import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormTextarea } from './FormTextarea';

describe('FormTextarea', () => {
  it('connects its label and hint to the textarea', () => {
    const html = renderToStaticMarkup(
      <FormTextarea label="Description" hint="Keep it short" name="description" rows={4} />,
    );

    expect(html).toContain('for="textarea-description"');
    expect(html).toContain('id="textarea-description"');
    expect(html).toContain('aria-describedby="textarea-description-hint"');
    expect(html).toContain('id="textarea-description-hint"');
    expect(html).toContain('name="description"');
    expect(html).toContain('rows="4"');
  });

  it('associates an error and marks the textarea invalid', () => {
    const html = renderToStaticMarkup(
      <FormTextarea label="Description" error="Description is required" hint="Keep it short" />,
    );

    expect(html).toContain('aria-describedby="textarea-description-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="textarea-description-error"');
    expect(html).not.toContain('id="textarea-description-hint"');
  });
});
