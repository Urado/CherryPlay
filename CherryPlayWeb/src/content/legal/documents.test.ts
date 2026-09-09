import { describe, expect, it } from 'vitest';

import { LEGAL_DOCUMENTS_CONTENT, LEGAL_OPERATOR_CONTENT } from './documents';
import { markdownBodyToParagraphs } from './parseLegalMarkdown';

describe('markdownBodyToParagraphs', () => {
  it('splits blank-line separated blocks', () => {
    expect(
      markdownBodyToParagraphs(`First paragraph.

Second paragraph.
`),
    ).toEqual(['First paragraph.', 'Second paragraph.']);
  });
});

describe('legal markdown documents', () => {
  it('loads privacy and operator from plain md + manifest', () => {
    expect(LEGAL_DOCUMENTS_CONTENT.privacy.title).toMatch(/Политика/i);
    expect(LEGAL_DOCUMENTS_CONTENT.privacy.paragraphs.length).toBeGreaterThan(0);
    expect(LEGAL_OPERATOR_CONTENT.generalContact).toContain('@');
    expect(LEGAL_OPERATOR_CONTENT.paragraphs.length).toBeGreaterThan(0);
  });
});
