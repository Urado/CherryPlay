jest.mock('@cherryplay/components', () => ({
  getDefaultCustomizationSettings: () => ({}),
}));

import {
  resetPartyWorkspaceState,
  usePartyWorkspaceStore,
} from '../../src/workspaces/party/partyWorkspaceStore';

describe('partyWorkspaceStore', () => {
  beforeEach(() => {
    resetPartyWorkspaceState();
  });

  it('starts with default basic theme and empty party name', () => {
    const state = usePartyWorkspaceStore.getState();
    expect(state.themeId).toBe('basic');
    expect(state.partyName).toBe('');
    expect(state.serverError).toBeNull();
    expect(state.partyVerified).toBe(false);
  });

  it('updates party fields', () => {
    const store = usePartyWorkspaceStore.getState();
    store.setPartyName('Friday Night');
    store.setPartyTitle('Dance Party');
    store.setThemeId('cyberpunk');

    expect(usePartyWorkspaceStore.getState().partyName).toBe('Friday Night');
    expect(usePartyWorkspaceStore.getState().partyTitle).toBe('Dance Party');
  });

  it('resetPartyWorkspaceState restores initial values', () => {
    const store = usePartyWorkspaceStore.getState();
    store.setPartyName('Temporary');
    store.setServerError('error');
    store.setPartyVerified(true);

    resetPartyWorkspaceState();

    const state = usePartyWorkspaceStore.getState();
    expect(state.partyName).toBe('');
    expect(state.serverError).toBeNull();
    expect(state.partyVerified).toBe(false);
  });
});
