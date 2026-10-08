import { render, screen } from '@testing-library/react';
import React from 'react';

import { ListRow } from '../../../../src/shared/components/ListRow/ListRow';

describe('ListRow nested group styling', () => {
  it('does not apply the first-level stripe class to deeper nested rows', () => {
    render(
      <ListRow id="track-deep" level={2} baseClassName="playlist-item">
        Deep track
      </ListRow>,
    );

    const row = screen.getByRole('button');
    expect(row).not.toHaveClass('playlist-item--level-1');
    expect(row).toHaveStyle({ marginLeft: 'calc(var(--spacing-md, 16px) * 2)' });
  });
});
