import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { linkifyLegalText } from './linkifyLegalText';

function markup(text: string): string {
  return renderToStaticMarkup(<>{linkifyLegalText(text)}</>);
}

describe('linkifyLegalText', () => {
  it('strips trailing semicolon from URL href', () => {
    const html = markup('хостинг https://cloud.ru/; далее');
    expect(html).toContain('href="https://cloud.ru/"');
    expect(html).not.toContain('href="https://cloud.ru/;"');
    expect(html).toContain('>https://cloud.ru/</a>; далее');
  });

  it('strips trailing period from URL href', () => {
    const html = markup('сервис https://rusender.ru/.');
    expect(html).toContain('href="https://rusender.ru/"');
    expect(html).not.toContain('href="https://rusender.ru/."');
    expect(html).toContain('>https://rusender.ru/</a>.');
  });

  it('keeps clean URLs unchanged', () => {
    const html = markup('см. https://cloud.ru/');
    expect(html).toContain('href="https://cloud.ru/"');
    expect(html).toContain('>https://cloud.ru/</a>');
  });

  it('linkifies mailto and bare emails', () => {
    const html = markup('пиши support@cherryplay.ru или mailto:ops@cherryplay.ru');
    expect(html).toContain('href="mailto:support@cherryplay.ru"');
    expect(html).toContain('href="mailto:ops@cherryplay.ru"');
  });
});
