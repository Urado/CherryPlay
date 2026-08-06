import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormButton } from './FormButton';

describe('FormButton', () => {
  it('maps outline variant to cp-button--ghost', () => {
    const html = renderToStaticMarkup(<FormButton variant="outline">Cancel</FormButton>);
    expect(html).toContain('cp-button--ghost');
    expect(html).not.toContain('cp-button--outline');
  });

  it('passes through loading, fullWidth, type="submit", and className', () => {
    const html = renderToStaticMarkup(
      <FormButton loading fullWidth type="submit" className="custom-class">
        Submit
      </FormButton>,
    );
    expect(html).toContain('cp-button--loading');
    expect(html).toContain('cp-button--full-width');
    expect(html).toContain('type="submit"');
    expect(html).toContain('custom-class');
    expect(html).toContain('form-button');
  });

  it('shows loading text «Загрузка...»', () => {
    const html = renderToStaticMarkup(<FormButton loading>Submit</FormButton>);
    expect(html).toContain('Загрузка...');
    expect(html).not.toContain('Submit');
  });

  it('renders disabled state correctly', () => {
    const html = renderToStaticMarkup(<FormButton disabled>Off</FormButton>);
    expect(html).toContain('disabled');
    expect(html).toContain('form-button');
  });
});
