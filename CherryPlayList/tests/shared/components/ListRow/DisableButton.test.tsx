import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { DisableButton } from '../../../../src/shared/components/ListRow/actions/DisableButton';
import { ListRow } from '../../../../src/shared/components/ListRow/ListRow';

describe('DisableButton', () => {
  it('uses danger tone while the track is excluded', () => {
    render(
      <ListRow id="track-1" isDisabled baseClassName="playlist-item">
        <DisableButton />
      </ListRow>,
    );

    expect(
      screen.getByRole('button', { name: 'Снова включить трек в проигрывание' }),
    ).toHaveClass('cp-button--tone-danger');
  });

  it('keeps the normal tone while the track is included', () => {
    render(
      <ListRow id="track-1" isDisabled={false} baseClassName="playlist-item">
        <DisableButton />
      </ListRow>,
    );

    expect(
      screen.getByRole('button', { name: 'Пропустить трек на вечеринке (можно снова включить)' }),
    ).not.toHaveClass('cp-button--tone-danger');
  });
});
