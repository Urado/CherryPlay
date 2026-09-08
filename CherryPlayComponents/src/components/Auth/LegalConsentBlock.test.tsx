import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LEGAL_PD_CONSENT, LEGAL_TERMS } from '../../constants/legalDocuments';

import { LegalConsentBlock } from './LegalConsentBlock';

describe('LegalConsentBlock', () => {
  it('renders unchecked Habr-style checkboxes with current-path links', () => {
    const html = renderToStaticMarkup(
      <LegalConsentBlock
        pdConsentAccepted={false}
        termsAccepted={false}
        onPdConsentChange={() => undefined}
        onTermsChange={() => undefined}
      />,
    );

    expect(html).toContain('data-legal-consent="pd"');
    expect(html).toContain('data-legal-consent="terms"');
    expect(html).toContain(LEGAL_PD_CONSENT.currentPath);
    expect(html).toContain(LEGAL_TERMS.currentPath);
    expect(html).not.toContain(LEGAL_PD_CONSENT.archivePath);
    expect(html).not.toContain(LEGAL_TERMS.archivePath);
    expect(html).toContain('Я принимаю условия');
    expect(html).toContain('Я даю согласие на обработку персональных данных');
    expect(html).toContain('Пользовательского соглашения');
    expect(html).toContain('текстом согласия');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="Я принимаю условия Пользовательского соглашения"');
    expect(html).toContain(
      'aria-label="Я даю согласие на обработку персональных данных в соответствии с текстом согласия"',
    );
    const labels = html.match(/<label[\s\S]*?<\/label>/g) ?? [];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).not.toContain('<a');
    }
    expect(html.match(/checked/g)).toBeNull();
  });

  it('marks both checkboxes checked when accepted', () => {
    const html = renderToStaticMarkup(
      <LegalConsentBlock
        pdConsentAccepted
        termsAccepted
        onPdConsentChange={() => undefined}
        onTermsChange={() => undefined}
      />,
    );

    expect(html).toContain('checked');
  });
});
