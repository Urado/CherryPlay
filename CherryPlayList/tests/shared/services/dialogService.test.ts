import { dialogService } from '../../../src/shared/services/dialogService';

describe('dialogService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('resolves a confirmation and presents queued alerts in order', async () => {
    const confirmation = dialogService.confirm({
      title: 'Подтверждение',
      message: 'Продолжить?',
    });
    const alert = dialogService.alert({
      title: 'Предупреждение',
      message: 'Готово',
    });
    const activeConfirmation = dialogService.getSnapshot();

    expect(activeConfirmation?.type).toBe('confirm');
    if (!activeConfirmation) {
      throw new Error('Expected the confirmation to become active');
    }
    dialogService.close(activeConfirmation.id, false);

    await expect(confirmation).resolves.toBe(false);
    expect(dialogService.getSnapshot()).toBeNull();

    jest.runOnlyPendingTimers();
    const activeAlert = dialogService.getSnapshot();

    expect(activeAlert?.type).toBe('alert');
    if (!activeAlert) {
      throw new Error('Expected the alert to become active');
    }
    dialogService.close(activeAlert.id, true);

    await expect(alert).resolves.toBeUndefined();
    expect(dialogService.getSnapshot()).toBeNull();
  });
});
