import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('renders primary variant with label', () => {
    const html = renderToStaticMarkup(<Button variant="primary">Submit</Button>);
    expect(html).toContain('cp-button--primary');
    expect(html).toContain('Submit');
  });

  it('renders secondary and danger variants', () => {
    const secondary = renderToStaticMarkup(<Button variant="secondary">Cancel</Button>);
    const danger = renderToStaticMarkup(<Button variant="danger">Delete</Button>);
    expect(secondary).toContain('cp-button--secondary');
    expect(danger).toContain('cp-button--danger');
  });

  it('renders ghost variant and small size', () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" size="sm">
        More
      </Button>,
    );
    expect(html).toContain('cp-button--ghost');
    expect(html).toContain('cp-button--sm');
  });

  it('marks disabled and loading states', () => {
    const disabled = renderToStaticMarkup(<Button disabled>Off</Button>);
    const loading = renderToStaticMarkup(<Button loading>On</Button>);
    expect(disabled).toContain('disabled');
    expect(loading).toContain('cp-button--loading');
    expect(loading).toContain('Загрузка...');
    expect(loading).toContain('disabled');
  });

  it('renders fullWidth and iconOnly modifiers', () => {
    const fullWidth = renderToStaticMarkup(<Button fullWidth>Wide</Button>);
    const iconOnly = renderToStaticMarkup(
      <Button iconOnly startIcon={<span data-testid="icon">+</span>} aria-label="Add" />,
    );
    expect(fullWidth).toContain('cp-button--full-width');
    expect(iconOnly).toContain('cp-button--icon-only');
  });

  it('uses custom loadingLabel when loading', () => {
    const html = renderToStaticMarkup(
      <Button loading loadingLabel="Сохранение...">
        Save
      </Button>,
    );
    expect(html).toContain('Сохранение...');
    expect(html).not.toContain('Save');
  });

  it('defaults type to button', () => {
    const html = renderToStaticMarkup(<Button>Submit</Button>);
    expect(html).toContain('type="button"');
  });

  it('shows loading spinner for iconOnly without replacing children text', () => {
    const html = renderToStaticMarkup(
      <Button iconOnly loading startIcon={<span>+</span>} aria-label="Add" />,
    );
    expect(html).toContain('cp-button--loading');
    expect(html).toContain('cp-button__icon--loading');
    expect(html).not.toContain('cp-button__label');
  });

  it('applies fill-hover with tone danger and no-hover chrome', () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" tone="danger" hoverable={false} filled="hover" aria-label="Delete">
        Delete
      </Button>,
    );
    expect(html).toContain('cp-button--tone-danger');
    expect(html).toContain('cp-button--no-hover');
    expect(html).toContain('cp-button--fill-hover');
  });

  it('applies tone danger and no-hover when hoverable is false', () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" tone="danger" hoverable={false} aria-label="Delete">
        Delete
      </Button>,
    );
    expect(html).toContain('cp-button--tone-danger');
    expect(html).toContain('cp-button--no-hover');
    expect(html).not.toContain('cp-button--borderless');
  });

  it('omits tone class for neutral and omits no-hover when hoverable', () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" tone="neutral" hoverable>
        Ok
      </Button>,
    );
    expect(html).not.toContain('cp-button--tone-');
    expect(html).not.toContain('cp-button--no-hover');
  });
});
