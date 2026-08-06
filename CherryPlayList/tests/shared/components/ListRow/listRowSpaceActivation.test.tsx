import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { ListRow } from '../../../../src/shared/components/ListRow/ListRow';

describe('ListRow keyboard activation', () => {
  it('activates on Enter but not on Space', () => {
    const onClick = jest.fn();
    render(
      <ListRow id="track-1" onClick={onClick}>
        Track
      </ListRow>,
    );

    const row = screen.getByRole('button');
    expect(row).toHaveAttribute('data-list-row');

    fireEvent.keyDown(row, { key: ' ', code: 'Space' });
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.keyDown(row, { key: 'Enter', code: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
