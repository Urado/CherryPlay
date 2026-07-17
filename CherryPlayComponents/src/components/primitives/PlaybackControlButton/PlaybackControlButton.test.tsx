import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PlaybackControlButton } from './PlaybackControlButton';

describe('PlaybackControlButton', () => {
  it.each(['play', 'pause', 'stop', 'next', 'error'] as const)(
    'renders %s control variant',
    (control) => {
      const html = renderToStaticMarkup(
        <PlaybackControlButton control={control} aria-label={`Test ${control}`} />,
      );
      expect(html).toContain('cp-playback-control');
      expect(html).toContain(`cp-playback-control--md`);
      expect(html).toContain(`aria-label="Test ${control}"`);
      expect(html).toContain('<svg');
    },
  );

  it('applies emphasis size class for play on md', () => {
    const html = renderToStaticMarkup(
      <PlaybackControlButton control="play" size="md" aria-label="Play" />,
    );
    expect(html).toContain('cp-playback-control--emphasis');
    expect(html).toContain('cp-icon--lg');
  });

  it('uses sm size without emphasis for compact transport', () => {
    const html = renderToStaticMarkup(
      <PlaybackControlButton control="play" size="sm" aria-label="Play" />,
    );
    expect(html).toContain('cp-playback-control--sm');
    expect(html).not.toContain('cp-playback-control--emphasis');
    expect(html).toContain('cp-icon--sm');
  });

  it('marks error control with error tone class', () => {
    const html = renderToStaticMarkup(
      <PlaybackControlButton control="error" aria-label="Playback failed" />,
    );
    expect(html).toContain('cp-playback-control--error');
    expect(html).toContain('cp-playback-control--emphasis');
  });

  it('falls back to title for accessible name', () => {
    const html = renderToStaticMarkup(
      <PlaybackControlButton control="stop" title="Начать заново" />,
    );
    expect(html).toContain('title="Начать заново"');
    expect(html).toContain('aria-label="Начать заново"');
  });
});
