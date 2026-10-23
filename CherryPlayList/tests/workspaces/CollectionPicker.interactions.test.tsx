import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CollectionPicker } from '../../src/workspaces/collection/CollectionPicker';

const renderPicker = (overrides: Partial<React.ComponentProps<typeof CollectionPicker>> = {}) => {
  const props: React.ComponentProps<typeof CollectionPicker> = {
    collectionId: 'current',
    name: 'Вечерний сет',
    collections: [
      { id: 'current', name: 'Вечерний сет' },
      { id: 'next', name: 'Основная программа' },
    ],
    onSelect: jest.fn(),
    onCreate: jest.fn(),
    onRename: jest.fn(),
    ...overrides,
  };
  return { ...render(<CollectionPicker {...props} />), props };
};

describe('CollectionPicker interactions', () => {
  it('shows a direct rename action and commits the edited name', async () => {
    const user = userEvent.setup();
    const onRename = jest.fn();
    renderPicker({ onRename });

    await user.click(screen.getByRole('button', { name: 'Переименовать подборку' }));
    const nameField = screen.getByRole('textbox', { name: 'Название подборки' });
    expect(nameField).toHaveFocus();
    await user.clear(nameField);
    await user.type(nameField, 'Новый сет{Enter}');

    expect(onRename).toHaveBeenCalledWith('Новый сет');
    expect(screen.getByRole('button', { name: 'Подборка: Вечерний сет' })).toBeInTheDocument();
  });

  it('places the rename action before the collection menu arrow', () => {
    renderPicker();
    const controls = screen.getAllByRole('button');

    expect(controls.map(({ className }) => className)).toEqual([
      'workspace-pill__label-btn',
      'workspace-pill__rename-btn',
      'workspace-pill__chevron-btn',
    ]);
  });

  it('omits export and copy actions from the collection menu', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));

    expect(screen.queryByRole('menuitem', { name: 'Экспортировать подборку в JSON' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Скопировать подборку в папку' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Переименовать текущую подборку…' })).not.toBeInTheDocument();
  });

  it('exposes the visual menu dividers as separators', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));

    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('selects another collection and creates a collection from the final menu action', async () => {
    const user = userEvent.setup();
    const { props } = renderPicker();

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Основная программа' }));
    expect(props.onSelect).toHaveBeenCalledWith('next');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));
    await user.click(screen.getByRole('menuitem', { name: 'Создать новую подборку' }));
    expect(props.onCreate).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and an outside pointer press', async () => {
    const user = userEvent.setup();
    renderPicker();

    const trigger = screen.getByRole('button', { name: 'Подборка: Вечерний сет' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
