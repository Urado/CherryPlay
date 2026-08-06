import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { InfoIcon } from './InfoIcon';

describe('Icon', () => {
  it('renders child glyph with size class', () => {
    const html = renderToStaticMarkup(
      <Icon size="lg">
        <svg data-testid="glyph" />
      </Icon>,
    );
    expect(html).toContain('cp-icon--lg');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-testid="glyph"');
  });

  it('supports sm and md sizes', () => {
    const sm = renderToStaticMarkup(
      <Icon size="sm">
        <span>*</span>
      </Icon>,
    );
    const md = renderToStaticMarkup(
      <Icon size="md">
        <span>*</span>
      </Icon>,
    );
    expect(sm).toContain('cp-icon--sm');
    expect(md).toContain('cp-icon--md');
  });

  it('applies circular outline class when shape is circle', () => {
    const html = renderToStaticMarkup(
      <Icon size="sm" shape="circle">
        i
      </Icon>,
    );
    expect(html).toContain('cp-icon--circle');
    expect(html).toContain('cp-icon--sm');
    expect(html).toContain('>i</span>');
  });
});

describe('InfoIcon', () => {
  it('renders circled i with title and accessible name', () => {
    const html = renderToStaticMarkup(<InfoIcon title="Portable mode help" />);
    expect(html).toContain('cp-icon--circle');
    expect(html).toContain('cp-icon--info');
    expect(html).toContain('title="Portable mode help"');
    expect(html).toContain('aria-label="Portable mode help"');
    expect(html).toContain('role="img"');
    expect(html).toContain('>i</span>');
  });
});

describe('IconButton', () => {
  it('composes icon-only button with required aria-label', () => {
    const html = renderToStaticMarkup(
      <IconButton icon={<svg />} aria-label="Close dialog" variant="ghost" />,
    );
    expect(html).toContain('cp-button--icon-only');
    expect(html).toContain('aria-label="Close dialog"');
    expect(html).toContain('cp-icon--md');
  });

  it('adapts icon size to button size by default', () => {
    const html = renderToStaticMarkup(
      <IconButton icon={<svg />} aria-label="Add item" variant="ghost" size="sm" />,
    );
    expect(html).toContain('cp-button--sm');
    expect(html).toContain('cp-icon--sm');
  });

  it('allows overriding icon size explicitly', () => {
    const html = renderToStaticMarkup(
      <IconButton
        icon={<svg />}
        aria-label="Open options"
        variant="ghost"
        size="sm"
        iconSize="md"
      />,
    );
    expect(html).toContain('cp-button--sm');
    expect(html).toContain('cp-icon--md');
  });
});
