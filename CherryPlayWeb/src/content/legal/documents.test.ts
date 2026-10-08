import { describe, expect, it } from 'vitest';

import { LEGAL_DOCUMENTS_CONTENT, LEGAL_OPERATOR_CONTENT } from './documents';
import { markdownBodyToParagraphs, parseLegalMarkdown } from './parseLegalMarkdown';

describe('parseLegalMarkdown', () => {
  it('emits headings, lists, and paragraphs', () => {
    const blocks = parseLegalMarkdown(`## Intro

Lead paragraph.

1. First section

— item one;
— item two;

1.1. Subsection title

Body under subsection.
`);

    expect(blocks).toEqual([
      { type: 'heading', level: 2, text: 'Intro' },
      { type: 'paragraph', text: 'Lead paragraph.' },
      { type: 'heading', level: 2, text: '1. First section' },
      { type: 'list', ordered: false, items: ['item one;', 'item two;'] },
      { type: 'heading', level: 3, text: '1.1. Subsection title' },
      { type: 'paragraph', text: 'Body under subsection.' },
    ]);
  });
});

describe('markdownBodyToParagraphs', () => {
  it('returns paragraph texts only', () => {
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
    expect(LEGAL_DOCUMENTS_CONTENT.privacy.blocks.length).toBeGreaterThan(0);
    expect(LEGAL_DOCUMENTS_CONTENT.privacy.blocks.some((b) => b.type === 'heading')).toBe(true);
    expect(LEGAL_DOCUMENTS_CONTENT.consent.blocks.some((b) => b.type === 'list')).toBe(true);
    expect(LEGAL_OPERATOR_CONTENT.generalContact).toBe('samurai-94@mail.ru');
    expect(LEGAL_OPERATOR_CONTENT.privacyContact).toBe('samurai-94@mail.ru');
    expect(LEGAL_OPERATOR_CONTENT.operatorName).toContain('Калёнов');
    expect(
      LEGAL_DOCUMENTS_CONTENT.privacy.blocks.some(
        (b) => b.type === 'paragraph' && /зрител/i.test(b.text),
      ),
    ).toBe(true);
    expect(LEGAL_OPERATOR_CONTENT.paragraphs.length).toBeGreaterThan(0);
  });
});
