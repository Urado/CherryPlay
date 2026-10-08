import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('@app/components/AccountView', () => ({
  AccountView: () => <div>Account actions</div>,
}));

import { AccountPopover } from '@app/components/AccountPopover';
import { ACCOUNT_POPOVER_OPEN_EVENT } from '@app/components/accountPopoverEvents';

describe('AccountPopover', () => {
  it('ignores global open requests while disabled', () => {
    render(<AccountPopover isAuthenticated={false} disabled />);

    act(() => {
      window.dispatchEvent(new Event(ACCOUNT_POPOVER_OPEN_EVENT));
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores focus to the trigger after closing with Escape', () => {
    render(<AccountPopover isAuthenticated={false} disabled={false} />);
    const trigger = screen.getByRole('button', { name: 'Аккаунт' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps focus on the clicked control after closing outside the popover', async () => {
    render(
      <>
        <AccountPopover isAuthenticated={false} disabled={false} />
        <button type="button">Outside</button>
      </>,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Аккаунт' });
    const outsideButton = screen.getByRole('button', { name: 'Outside' });

    await user.click(trigger);
    await user.click(outsideButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(outsideButton).toHaveFocus();
  });
});
