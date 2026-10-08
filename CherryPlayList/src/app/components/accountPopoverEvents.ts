export const ACCOUNT_POPOVER_OPEN_EVENT = 'cherryplay:open-account-popover';

export const requestAccountPopoverOpen = (): void => {
  window.dispatchEvent(new Event(ACCOUNT_POPOVER_OPEN_EVENT));
};
