import { describe, expect, it } from 'vitest';

import { LEGAL_DOCUMENTS_CONTENT } from './documents';

function allParagraphText(key: 'privacy' | 'consent'): string {
  return LEGAL_DOCUMENTS_CONTENT[key].blocks
    .filter((b) => b.type === 'paragraph')
    .map((b) => b.text)
    .join('\n');
}

describe('legal retention promises', () => {
  it('consent and privacy keep plain-language retention and Cloud.ru dump wording', () => {
    const consent = allParagraphText('consent');
    const privacy = allParagraphText('privacy');

    expect(consent).toMatch(/не позднее 30 дней/);
    expect(privacy).toMatch(/не позднее 30 дней/);

    expect(consent).toMatch(/не ведёт управляемые резервные копии Cloud\.ru/);
    expect(privacy).toMatch(/не ведёт управляемые резервные копии Cloud\.ru/);

    expect(consent).toMatch(/повторного применения удаления и очистки/);
    expect(privacy).toMatch(/повторного применения удаления и очистки/);

    expect(consent).toMatch(/3 года после удаления аккаунта/);
    expect(privacy).toMatch(/3 года после удаления аккаунта/);
  });
});
