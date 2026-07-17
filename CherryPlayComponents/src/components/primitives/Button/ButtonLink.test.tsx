import type { MouseEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ButtonLink } from './ButtonLink';
import { createDisabledLinkClickHandler } from './buttonShared';

describe('ButtonLink', () => {
  it('renders anchor with cp-button classes', () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/cabinet" variant="secondary" size="sm">
        Кабинет
      </ButtonLink>,
    );
    expect(html).toContain('<a');
    expect(html).toContain('href="/cabinet"');
    expect(html).toContain('cp-button--secondary');
    expect(html).toContain('cp-button--sm');
    expect(html).toContain('cp-button__label');
    expect(html).toContain('Кабинет');
  });

  it('marks disabled state with aria-disabled and cp-button--disabled', () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/cabinet" disabled>
        Кабинет
      </ButtonLink>,
    );
    expect(html).toContain('cp-button--disabled');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="-1"');
  });

  it('renders primary variant by default', () => {
    const html = renderToStaticMarkup(<ButtonLink href="/test">Go</ButtonLink>);
    expect(html).toContain('cp-button--primary');
    expect(html).toContain('cp-button--md');
  });

  it('renders startIcon and endIcon slots with aria-hidden when label is visible', () => {
    const html = renderToStaticMarkup(
      <ButtonLink
        href="/next"
        startIcon={<span data-testid="start">←</span>}
        endIcon={<span>→</span>}
      >
        Next
      </ButtonLink>,
    );
    expect(html).toContain('cp-button__icon--start');
    expect(html).toContain('cp-button__icon--end');
    expect(html).toContain('cp-button__label');
    expect(html).toContain('Next');
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(2);
  });

  it('applies chrome props to CSS classes', () => {
    const html = renderToStaticMarkup(
      <ButtonLink
        href="/delete"
        variant="ghost"
        tone="danger"
        hoverable={false}
        filled="hover"
        borderless
      >
        Delete
      </ButtonLink>,
    );
    expect(html).toContain('cp-button--ghost');
    expect(html).toContain('cp-button--tone-danger');
    expect(html).toContain('cp-button--no-hover');
    expect(html).toContain('cp-button--fill-hover');
    expect(html).toContain('cp-button--borderless');
  });

  it('renders iconOnly with children as icon content and aria-label', () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/settings" iconOnly aria-label="Settings">
        <span>⚙</span>
      </ButtonLink>,
    );
    expect(html).toContain('cp-button--icon-only');
    expect(html).toContain('cp-button__icon--start');
    expect(html).toContain('⚙');
    expect(html).not.toContain('cp-button__label');
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).toContain('aria-label="Settings"');
  });

  it('createDisabledLinkClickHandler blocks navigation when disabled', () => {
    const onClick = vi.fn();
    const handler = createDisabledLinkClickHandler(true, onClick);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    handler({
      preventDefault,
      stopPropagation,
    } as unknown as MouseEvent<HTMLAnchorElement>);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('createDisabledLinkClickHandler forwards click when enabled', () => {
    const onClick = vi.fn();
    const handler = createDisabledLinkClickHandler(false, onClick);
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent<HTMLAnchorElement>;

    handler(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledWith(event);
  });
});
