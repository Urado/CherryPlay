export interface AppDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface AppAlertOptions {
  title: string;
  message: string;
  confirmLabel?: string;
}

export type DialogRequest =
  | (AppDialogOptions & { id: number; type: 'confirm'; resolve: (result: boolean) => void })
  | (AppAlertOptions & { id: number; type: 'alert'; resolve: () => void });

type DialogListener = () => void;

let nextId = 0;
let activeDialog: DialogRequest | null = null;
const queuedDialogs: DialogRequest[] = [];
const listeners = new Set<DialogListener>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

const activateNextDialog = (): void => {
  if (activeDialog || queuedDialogs.length === 0) {
    return;
  }
  activeDialog = queuedDialogs.shift() ?? null;
  notify();
};

const enqueueDialog = (request: DialogRequest): void => {
  queuedDialogs.push(request);
  activateNextDialog();
};

const closeDialog = (id: number, confirmed: boolean): void => {
  if (!activeDialog || activeDialog.id !== id) {
    return;
  }

  const request = activeDialog;
  activeDialog = null;
  if (request.type === 'confirm') {
    request.resolve(confirmed);
  } else {
    request.resolve();
  }
  notify();
  window.setTimeout(activateNextDialog, 0);
};

export const dialogService = {
  alert(options: AppAlertOptions): Promise<void> {
    return new Promise((resolve) => {
      enqueueDialog({ ...options, id: ++nextId, type: 'alert', resolve });
    });
  },
  confirm(options: AppDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      enqueueDialog({ ...options, id: ++nextId, type: 'confirm', resolve });
    });
  },
  getSnapshot: (): DialogRequest | null => activeDialog,
  subscribe: (listener: DialogListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  close: closeDialog,
};
