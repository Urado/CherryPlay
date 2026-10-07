import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { ProjectGroup } from '../../../../src/core/types/project';
import { ProjectItemRow } from '../../../../src/shared/components/rows/ProjectItemRow';

const noop = () => undefined;

const group: ProjectGroup = {
  id: 'group-1',
  name: 'Group',
  items: [
    { id: 't1', type: 'track', path: '/t1.mp3', name: 't1' },
    { id: 't2', type: 'track', path: '/t2.mp3', name: 't2' },
  ],
};

const baseProps = {
  item: group,
  index: -1,
  listIndex: 0,
  mode: 'player-session' as const,
  isSelected: false,
  isDragging: false,
  onToggleSelect: noop,
  onRemove: noop,
  onDragStart: noop,
  onDragOver: noop,
  onDrop: noop,
  onDragEnd: noop,
};

describe('ProjectItemRow group more menu', () => {
  it('keeps group ⋯ enabled for an in-progress locked group when jump is available', () => {
    const onTrackActions = jest.fn();

    render(
      <ProjectItemRow
        {...baseProps}
        isLocked
        isPlayed={false}
        isCurrent={false}
        trackActionsDisabled={false}
        onTrackActions={onTrackActions}
      />,
    );

    const button = screen.getByRole('button', { name: 'Действия с группой' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onTrackActions).toHaveBeenCalledTimes(1);
    expect(onTrackActions.mock.calls[0][0]).toBe('group-1');
  });

  it('keeps group ⋯ disabled when the row is disabled, matching track parity', () => {
    render(
      <ProjectItemRow
        {...baseProps}
        isLocked
        isDisabled
        trackActionsDisabled={false}
        onTrackActions={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Действия с группой' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Действия с группой' })).toHaveAttribute(
      'title',
      'Элемент отключён',
    );
  });
});
