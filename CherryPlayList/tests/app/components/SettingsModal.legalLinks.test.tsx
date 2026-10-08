import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SettingsModal } from '../../../src/app/components/SettingsModal';
import { resetPlatformForTests, setPlatform } from '../../../src/shared/platform/platformContext';
import type { PlatformAPI } from '../../../src/shared/platform/types';
import { useUIStore } from '../../../src/shared/stores/uiStore';

const invokeMock = jest.fn(async (channel: string) =>
  channel === 'config:getWebBaseUrl'
    ? { success: true as const, data: 'https://example.test' }
    : { success: true as const },
);

const testPlatform = {
  getPathForFile: () => '',
  invoke: invokeMock,
  on: () => () => undefined,
  aimp: {
    getState: async () => ({ success: true as const }),
    setSourceSelection: async () => ({ success: true as const }),
    setLiveStreamStarted: async () => ({ success: true as const }),
    onStateChanged: () => () => undefined,
    onLog: () => () => undefined,
  },
} as unknown as PlatformAPI;

describe('SettingsModal legal links', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    useUIStore.getState().openModal('settings');
    setPlatform(testPlatform, 'electron');
  });

  afterEach(() => {
    cleanup();
    useUIStore.getState().closeModal();
    resetPlatformForTests();
  });

  it('opens both configured legal documents through the platform API', async () => {
    render(<SettingsModal />);

    const privacyButton = await screen.findByRole('button', {
      name: 'Политика персональных данных',
    });
    const legalButton = screen.getByRole('button', { name: 'Реквизиты и контакты' });

    await waitFor(() => expect(privacyButton).toBeEnabled());
    fireEvent.click(privacyButton);
    fireEvent.click(legalButton);

    expect(invokeMock).toHaveBeenCalledWith('legal:openDocument', { document: 'privacy' });
    expect(invokeMock).toHaveBeenCalledWith('legal:openDocument', { document: 'legal' });
  });
});
