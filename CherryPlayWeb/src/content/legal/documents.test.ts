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
    expect(LEGAL_OPERATOR_CONTENT.generalContact).toBe('samurai-94@mail.ru');
    expect(LEGAL_OPERATOR_CONTENT.privacyContact).toBe('samurai-94@mail.ru');
    expect(LEGAL_OPERATOR_CONTENT.operatorName).toContain('Калёнов');
    expect(LEGAL_DOCUMENTS_CONTENT.privacy.paragraphs.some((p) => /зрител/i.test(p))).toBe(true);
    expect(LEGAL_OPERATOR_CONTENT.paragraphs.length).toBeGreaterThan(0);
  });
});
