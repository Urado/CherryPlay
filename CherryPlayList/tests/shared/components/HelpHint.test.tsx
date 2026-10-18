import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { HelpHint } from '../../../src/shared/components/HelpHint';
import { useModalKeyboard } from '../../../src/shared/hooks/useModalKeyboard';

const Harness = ({ onCancel }: { onCancel: () => void }) => {
  useModalKeyboard({ enabled: true, onCancel });
  return <HelpHint label="Справка о поле">Короткое объяснение.</HelpHint>;
};

describe('HelpHint', () => {
  it('opens on focus and consumes Escape before the parent modal', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(<Harness onCancel={onCancel} />);

    await user.tab();

    expect(screen.getByRole('tooltip')).toBeVisible();
    expect(screen.getByRole('button')).toHaveAccessibleDescription('Короткое объяснение.');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps the first click readable after focus and closes on the second click', async () => {
    const user = userEvent.setup();
    render(<HelpHint label="Справка о поле">Короткое объяснение.</HelpHint>);
    const trigger = screen.getByRole('button', { name: 'Справка о поле' });

    await user.click(trigger);

    expect(screen.getByRole('tooltip')).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('dismisses a hint on an outside pointer press', () => {
    render(<HelpHint label="Справка о поле">Короткое объяснение.</HelpHint>);
    fireEvent.click(screen.getByRole('button', { name: 'Справка о поле' }));

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('stays open when the pointer moves from the trigger onto the explanation', () => {
    jest.useFakeTimers();
    render(<HelpHint label="Справка о поле">Короткое объяснение.</HelpHint>);
    const trigger = screen.getByRole('button', { name: 'Справка о поле' });
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    const tooltip = screen.getByRole('tooltip');

    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(tooltip, { pointerType: 'mouse' });
    jest.advanceTimersByTime(200);

    expect(tooltip).toBeVisible();
    jest.useRealTimers();
  });
});
