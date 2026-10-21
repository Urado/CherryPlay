import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CollectionPicker } from '../../src/workspaces/collection/CollectionPicker';

describe('CollectionPicker', () => {
  it('opens the collection menu from one field and keeps create as the final action', async () => {
    const user = userEvent.setup();
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
      />,
    );

    const field = screen.getByRole('button', { name: 'Подборка: Вечерний сет' });
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await user.click(field);

    const menuItems = screen.getAllByRole('menuitem');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
    expect(menuItems.map((item) => item.textContent)).toEqual(['Создать новую подборку']);
  });

  it('starts renaming from the pencil control and focuses the name field', async () => {
    const user = userEvent.setup();
    render(
      <CollectionPicker
        collectionId="current"
        name="Вечерний сет"
        collections={[{ id: 'current', name: 'Вечерний сет' }]}
        onSelect={jest.fn()}
        onCreate={jest.fn()}
        onRename={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Переименовать подборку' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Название подборки' })).toHaveFocus();
  });

  it.each(['{Enter}', ' '])('focuses the selected collection when the field opens with %s', async (key) => {
    const user = userEvent.setup();
    render(
      <CollectionPicker
        collectionId="next"
        name="Основная программа"
        collections={[
          { id: 'current', name: 'Вечерний сет' },
          { id: 'next', name: 'Основная программа' },
        ]}
        onSelect={jest.fn()}
        onCreate={jest.fn()}
        onRename={jest.fn()}
      />,
    );

    const field = screen.getByRole('button', { name: 'Подборка: Основная программа' });
    field.focus();
    await user.keyboard(key);

    const selectedCollection = screen.getByRole('menuitemradio', { name: 'Основная программа' });
    await waitFor(() => expect(selectedCollection).toHaveFocus());
  });

  it.each(['{Enter}', ' '])('closes a pointer-open menu when the field receives %s', async (key) => {
    const user = userEvent.setup();
    render(
      <CollectionPicker
        collectionId="current"
        name="Вечерний сет"
        collections={[{ id: 'current', name: 'Вечерний сет' }]}
        onSelect={jest.fn()}
        onCreate={jest.fn()}
        onRename={jest.fn()}
      />,
    );

    const field = screen.getByRole('button', { name: 'Подборка: Вечерний сет' });
    await user.click(field);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard(key);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(field).toHaveFocus();
  });

  it('moves from rename directly to create during keyboard navigation', async () => {
    const user = userEvent.setup();
    render(
      <CollectionPicker
        collectionId="current"
        name="Пустая подборка"
        collections={[{ id: 'current', name: 'Пустая подборка' }]}
        onSelect={jest.fn()}
        onCreate={jest.fn()}
        onRename={jest.fn()}
      />,
    );

    const field = screen.getByRole('button', { name: 'Подборка: Пустая подборка' });
    field.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Пустая подборка' })).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Создать новую подборку' })).toHaveFocus();
  });
});
