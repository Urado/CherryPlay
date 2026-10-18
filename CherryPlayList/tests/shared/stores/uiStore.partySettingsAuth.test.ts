import { dialogService } from '../../../src/shared/services/dialogService';
import { useUIStore } from '../../../src/shared/stores/uiStore';

let mockAuthenticated = false;

jest.mock('../../../src/shared/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({ isAuthenticated: () => mockAuthenticated }),
  },
}));

describe('party settings authentication gate', () => {
  beforeEach(() => {
    mockAuthenticated = false;
    useUIStore.setState({ modal: null, modalReturnTo: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers login without opening settings and opens account on confirmation', async () => {
    const confirm = jest.spyOn(dialogService, 'confirm').mockResolvedValue(true);

    useUIStore.getState().openPartySettingsModal();

    expect(useUIStore.getState().modal).toBeNull();
    expect(confirm).toHaveBeenCalledWith({
      title: 'Войдите в аккаунт',
      message: 'Настройки вечеринки доступны после входа в аккаунт.',
      confirmLabel: 'Войти',
      cancelLabel: 'Отмена',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(useUIStore.getState().modal).toBe('account');
  });

  it('keeps settings closed after cancellation through the generic modal entry', async () => {
    jest.spyOn(dialogService, 'confirm').mockResolvedValue(false);

    useUIStore.getState().openModal('partySettings');
    await Promise.resolve();
    await Promise.resolve();

    expect(useUIStore.getState().modal).toBeNull();
  });

  it('opens settings immediately for an authenticated organizer', () => {
    mockAuthenticated = true;
    const confirm = jest.spyOn(dialogService, 'confirm');

    useUIStore.getState().openPartySettingsModal();

    expect(useUIStore.getState().modal).toBe('partySettings');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('shows one login dialog when settings are requested repeatedly', async () => {
    let resolveConfirmation: (confirmed: boolean) => void = () => undefined;
    const confirm = jest.spyOn(dialogService, 'confirm').mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveConfirmation = resolve;
        }),
    );

    useUIStore.getState().openPartySettingsModal();
    useUIStore.getState().openModal('partySettings');

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().modal).toBeNull();
    resolveConfirmation(false);
    await Promise.resolve();
    await Promise.resolve();
  });
});
