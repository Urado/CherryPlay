import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { linkifyLegalText } from './linkifyLegalText';

const markup = (text: string): string => {
  return renderToStaticMarkup(<>{linkifyLegalText(text)}</>);
};

describe('linkifyLegalText', () => {
  it('strips trailing semicolon from URL href', () => {
    const view = markup('хостинг https://cloud.ru/; далее');
    expect(view).toContain('href="https://cloud.ru/"');
    expect(view).not.toContain('href="https://cloud.ru/;"');
    expect(view).toContain('>https://cloud.ru/</a>; далее');
  });

  it('strips trailing period from URL href', () => {
    const view = markup('сервис https://rusender.ru/.');
    expect(view).toContain('href="https://rusender.ru/"');
    expect(view).not.toContain('href="https://rusender.ru/."');
    expect(view).toContain('>https://rusender.ru/</a>.');
  });

  it('keeps clean URLs unchanged', () => {
    const view = markup('см. https://cloud.ru/');
    expect(view).toContain('href="https://cloud.ru/"');
    expect(view).toContain('>https://cloud.ru/</a>');
  });

  it('linkifies mailto and bare emails', () => {
    const view = markup('пиши support@cherryplay.ru или mailto:ops@cherryplay.ru');
    expect(view).toContain('href="mailto:support@cherryplay.ru"');
    expect(view).toContain('href="mailto:ops@cherryplay.ru"');
  });
});
