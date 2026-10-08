import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { ActionButton } from '../../../../src/shared/components/ListRow/actions/ActionButton';
import { ListRow } from '../../../../src/shared/components/ListRow/ListRow';

describe('ActionButton for played tracks', () => {
  it('keeps an opted-in action enabled and clickable on a played row', () => {
    const onClick = jest.fn();

    render(
      <ListRow id="track-1" isPlayed isLocked baseClassName="playlist-item">
        <ActionButton
          aria-label="Действия с треком"
          allowWhenPlayedLocked
          icon={<span>⋮</span>}
          onClick={onClick}
        />
      </ListRow>,
    );

    const button = screen.getByRole('button', { name: 'Действия с треком' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps an opted-in action locked for the current row', () => {
    render(
      <ListRow id="track-1" isPlayed isCurrent isLocked baseClassName="playlist-item">
        <ActionButton
          aria-label="Действия с треком"
          allowWhenPlayedLocked
          icon={<span>⋮</span>}
        />
      </ListRow>,
    );

    expect(screen.getByRole('button', { name: 'Действия с треком' })).toBeDisabled();
  });

  it('keeps an opted-in action enabled on a locked in-progress group row', () => {
    const onClick = jest.fn();

    render(
      <ListRow id="group-1" isLocked baseClassName="playlist-item">
        <ActionButton
          aria-label="Действия с группой"
          allowWhenPlayedLocked
          icon={<span>⋮</span>}
          onClick={onClick}
        />
      </ListRow>,
    );

    const button = screen.getByRole('button', { name: 'Действия с группой' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps an explicitly disabled action locked on an excluded row', () => {
    render(
      <ListRow id="track-1" isPlayed isLocked isDisabled baseClassName="playlist-item">
        <ActionButton
          aria-label="Действия с треком"
          allowWhenPlayedLocked
          disabled
          icon={<span>⋮</span>}
        />
      </ListRow>,
    );

    expect(screen.getByRole('button', { name: 'Действия с треком' })).toBeDisabled();
  });
});
