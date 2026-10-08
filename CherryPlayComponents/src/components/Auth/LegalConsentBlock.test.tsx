import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  LEGAL_PD_CONSENT,
  LEGAL_TERMS,
  type LegalDocumentDeployConfig,
} from '../../constants/legalDocuments';

import { LegalConsentBlock } from './LegalConsentBlock';

describe('LegalConsentBlock', () => {
  it('renders unchecked CP-036 copy, archive links, and accessible summaries', () => {
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
    expectConsentItem(html, 'terms', LEGAL_TERMS);
    expectConsentItem(html, 'pd', LEGAL_PD_CONSENT);
    expect(html).toContain('rel="noopener noreferrer"');
    const labels = html.match(/<label[\s\S]*?<\/label>/g) ?? [];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).not.toContain('<a');
    }
    expect(html.match(/<input[^>]*\bchecked\b/g)).toBeNull();
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

const expectConsentItem = (
  html: string,
  key: 'pd' | 'terms',
  document: LegalDocumentDeployConfig,
) => {
  const input =
    html.match(
      new RegExp(
        `<input id="([^"]+)"[^>]*data-legal-consent="${key}"[^>]*aria-describedby="([^"]+)"`,
      ),
    ) ?? [];
  const inputId = input[1];
  const summaryId = input[2];

  expect(inputId).toBeDefined();
  expect(summaryId).toBeDefined();
  expect(html).toContain(`<label class="legal-consent-label" for="${inputId}">${document.checkboxLabel}</label>`);
  expect(html).toContain(
    `<p id="${summaryId}" class="legal-consent-summary">${document.summary}</p>`,
  );
  expect(html).toContain(`href="${document.archivePath}"`);
  expect(html).not.toContain(`href="${document.currentPath}"`);
};
