import { AccountPopover } from '@app/components/AccountPopover';
import { ACCOUNT_POPOVER_OPEN_EVENT } from '@app/components/accountPopoverEvents';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@app/components/AccountView', () => ({
  AccountView: () => (
    <div>
      <input aria-label="Email" />
      <button type="button">Continue</button>
    </div>
  ),
}));

describe('AccountPopover focus management', () => {
  it('moves focus into the panel and restores it to the action that opened it', () => {
    render(
      <>
        <button type="button">Open account action</button>
        <AccountPopover isAuthenticated={false} disabled={false} />
      </>,
    );

    const opener = screen.getByRole('button', { name: 'Open account action' });
    opener.focus();
    act(() => {
      window.dispatchEvent(new Event(ACCOUNT_POPOVER_OPEN_EVENT));
    });

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
