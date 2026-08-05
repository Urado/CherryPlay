import { shouldBlockPlayerSpaceShortcut } from '../../../src/shared/shortcuts/shortcutUtils';

function makeEvent(target: Element): KeyboardEvent {
  return { target } as unknown as KeyboardEvent;
}

describe('shouldBlockPlayerSpaceShortcut', () => {
  it('allows Space on a ListRow (role=button + data-list-row)', () => {
    const row = document.createElement('div');
    row.setAttribute('role', 'button');
    row.setAttribute('data-list-row', '');
    document.body.appendChild(row);

    expect(shouldBlockPlayerSpaceShortcut(makeEvent(row))).toBe(false);

    const child = document.createElement('span');
    row.appendChild(child);
    expect(shouldBlockPlayerSpaceShortcut(makeEvent(child))).toBe(false);

    row.remove();
  });

  it('blocks Space on toolbar buttons, inputs, and dialogs', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    expect(shouldBlockPlayerSpaceShortcut(makeEvent(button))).toBe(true);
    button.remove();

    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(shouldBlockPlayerSpaceShortcut(makeEvent(input))).toBe(true);
    input.remove();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const span = document.createElement('span');
    dialog.appendChild(span);
    document.body.appendChild(dialog);
    expect(shouldBlockPlayerSpaceShortcut(makeEvent(span))).toBe(true);
    dialog.remove();
  });

  it('blocks Space on a real button nested inside a ListRow', () => {
    const row = document.createElement('div');
    row.setAttribute('role', 'button');
    row.setAttribute('data-list-row', '');
    const nested = document.createElement('button');
    row.appendChild(nested);
    document.body.appendChild(row);

    expect(shouldBlockPlayerSpaceShortcut(makeEvent(nested))).toBe(true);

    row.remove();
  });

  it('blocks Space on role=button without data-list-row', () => {
    const fake = document.createElement('div');
    fake.setAttribute('role', 'button');
    document.body.appendChild(fake);

    expect(shouldBlockPlayerSpaceShortcut(makeEvent(fake))).toBe(true);

    fake.remove();
  });
});
