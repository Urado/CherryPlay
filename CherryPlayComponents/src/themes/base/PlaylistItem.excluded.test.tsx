import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PlayerItem } from '../../types';

import { PlaylistItem } from './PlaylistItem';

describe('excluded playlist track', () => {
  it('renders a disabled state, an accessible reason, and a stop icon', () => {
    const item: PlayerItem = {
      id: 'track-1',
      type: 'track',
      name: 'Excluded track.mp3',
      displayOrder: 0,
      level: 0,
    };
    const markup = renderToStaticMarkup(
      <PlaylistItem item={item} index={0} level={0} isDisabled />,
    );

    expect(markup).toContain('party-playlist-item--disabled');
    expect(markup).toContain('data-state="disabled"');
    expect(markup).toContain('title="Трек отменён"');
    expect(markup).toContain('<rect');
  });
});
