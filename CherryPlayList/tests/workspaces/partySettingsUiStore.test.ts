import { useAuthStore } from '../../src/shared/stores/authStore';
import { openPartySettingsModal, useUIStore } from '../../src/shared/stores/uiStore';
import {
  resetPartySettingsUiState,
  usePartySettingsUiStore,
} from '../../src/workspaces/party/partySettingsUiStore';

describe('partySettingsUiStore', () => {
  beforeEach(() => {
    resetPartySettingsUiState();
    useUIStore.setState({ modal: null });
  });

  it('defaults preview design panel closed', () => {
    const state = usePartySettingsUiStore.getState();
    expect(state.previewDesignOpen).toBe(false);
  });

  it('togglePreviewDesignOpen opens and closes design panel', () => {
    usePartySettingsUiStore.getState().togglePreviewDesignOpen();
    expect(usePartySettingsUiStore.getState().previewDesignOpen).toBe(true);
    usePartySettingsUiStore.getState().togglePreviewDesignOpen();
    expect(usePartySettingsUiStore.getState().previewDesignOpen).toBe(false);
  });
});

describe('openPartySettingsModal', () => {
  beforeEach(() => {
    useUIStore.setState({ modal: null });
    useAuthStore.getState().clearAuth();
  });

  it('opens partySettings modal for an authenticated organizer', () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      organizer: { id: 'test-organizer', name: 'Test Organizer' },
    });

    openPartySettingsModal();
    const state = useUIStore.getState();
    expect(state.modal).toBe('partySettings');
  });
});
