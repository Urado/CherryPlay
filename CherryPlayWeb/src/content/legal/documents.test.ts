import { describe, expect, it } from 'vitest';

import { LEGAL_DOCUMENTS_CONTENT, LEGAL_OPERATOR_CONTENT } from './documents';
import { markdownBodyToParagraphs, parseLegalMarkdown } from './parseLegalMarkdown';

describe('parseLegalMarkdown', () => {
  it('reads frontmatter and body', () => {
    const { meta, body } = parseLegalMarkdown(`---
title: Test
documentVersion: "1.0"
---

First paragraph.

Second paragraph.
`);
    expect(meta.title).toBe('Test');
    expect(meta.documentVersion).toBe('1.0');
    expect(markdownBodyToParagraphs(body)).toEqual(['First paragraph.', 'Second paragraph.']);
  });
});

describe('legal markdown documents', () => {
  it('loads privacy and operator from md', () => {
    expect(LEGAL_DOCUMENTS_CONTENT.privacy.title).toMatch(/Политика/i);
    expect(LEGAL_DOCUMENTS_CONTENT.privacy.paragraphs.length).toBeGreaterThan(0);
    expect(LEGAL_OPERATOR_CONTENT.generalContact).toContain('@');
    expect(LEGAL_OPERATOR_CONTENT.paragraphs.length).toBeGreaterThan(0);
  });
});
