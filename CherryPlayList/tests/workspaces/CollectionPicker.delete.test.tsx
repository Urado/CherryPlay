import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CollectionPicker } from '../../src/workspaces/collection/CollectionPicker';

describe('CollectionPicker deletion', () => {
  it('calls the delete handler for the selected collection row', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(
      <CollectionPicker
        collectionId="current"
        name="Вечерний сет"
        collections={[
          { id: 'current', name: 'Вечерний сет' },
          { id: 'next', name: 'Основная программа' },
        ]}
        onSelect={jest.fn()}
        onCreate={jest.fn()}
        onRename={jest.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));
    await user.click(screen.getByRole('menuitem', { name: 'Удалить подборку Основная программа' }));

    expect(onDelete).toHaveBeenCalledWith('next');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
