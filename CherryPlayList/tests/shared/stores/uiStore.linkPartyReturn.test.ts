import { useUIStore } from '../../../src/shared/stores/uiStore';

describe('link party modal return flow', () => {
  afterEach(() => {
    useUIStore.getState().closeModal();
  });

  it('returns to party settings after the link dialog closes', () => {
    const store = useUIStore.getState();
    store.openPartySettingsModal();
    useUIStore.getState().openLinkPartyModal('partySettings');

    expect(useUIStore.getState().modal).toBe('linkParty');

    useUIStore.getState().closeModal();

    expect(useUIStore.getState().modal).toBe('partySettings');
    expect(useUIStore.getState().modalReturnTo).toBeNull();
  });

  it('closes a link dialog opened without a return target', () => {
    useUIStore.getState().openLinkPartyModal();

    useUIStore.getState().closeModal();

    expect(useUIStore.getState().modal).toBeNull();
  });
});
