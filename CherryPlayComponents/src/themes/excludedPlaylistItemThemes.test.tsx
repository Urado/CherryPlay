import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import '../components/Playlist/PlaylistItem.css';
import type { PlayerItem } from '../types';

import './art-deco/playlist-item.css';
import { PlaylistItem as BasePlaylistItem } from './base/PlaylistItem';
import { PlaylistItem as SpringPlaylistItem } from './spring-cross-step/PlaylistItem';
import './spring-cross-step/playlist-item.css';
import './basic/playlist-item.css';

const excludedTrack: PlayerItem = {
  id: 'excluded-track',
  type: 'track',
  name: 'Excluded track.mp3',
  displayOrder: 0,
  level: 0,
};

describe('excluded playlist track themes', () => {
  it('renders the disabled stop icon in the base theme', () => {
    const markup = renderToStaticMarkup(
      <div data-theme="basic">
        <BasePlaylistItem item={excludedTrack} index={0} level={0} isDisabled />
      </div>,
    );

    expect(markup).toContain('party-playlist-item--disabled');
    expect(markup).toContain('data-state="disabled"');
    expect(markup).toContain('<rect');
  });

  it('keeps the excluded marker red without overriding Art Deco row dimming', () => {
    const markup = renderToStaticMarkup(
      <div data-theme="art-deco">
        <BasePlaylistItem item={excludedTrack} index={0} level={0} isDisabled />
      </div>,
    );

    expect(markup).toContain('data-state="disabled"');
    expect(markup).toContain('class="party-playlist-item party-playlist-item--track');
  });

  it('renders a stop marker and keeps the excluded state accessible in Spring Cross Step', () => {
    const markup = renderToStaticMarkup(
      <div data-theme="spring-cross-step">
        <SpringPlaylistItem item={excludedTrack} index={0} level={0} isDisabled />
      </div>,
    );

    expect(markup).toContain('aria-label="Трек отменён"');
    expect(markup).toContain('data-state="disabled"');
    expect(markup).toContain('<rect');
    expect(markup).not.toContain('background:#dc2626');
  });

  it('keeps the included track marker in its theme-specific normal state', () => {
    const markup = renderToStaticMarkup(
      <div data-theme="basic">
        <BasePlaylistItem item={excludedTrack} index={0} level={0} />
      </div>,
    );

    expect(markup).toContain('data-state="upcoming"');
    expect(markup).toContain('>1</div>');
    expect(markup).not.toContain('background:#dc2626');
  });
});
