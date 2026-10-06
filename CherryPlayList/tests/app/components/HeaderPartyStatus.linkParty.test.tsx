import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

const mockOpenModal = jest.fn();
const mockAddNotification = jest.fn();
const mockAuthenticated = { value: true };
const mockPublishState = { synced: false };
const mockUiState = {
  openModal: (...args: unknown[]) => mockOpenModal(...args),
  addNotification: (...args: unknown[]) => mockAddNotification(...args),
};

jest.mock('@shared/stores', () => {
  const projectState = {
    get meta() {
      return {
        linkedParty: mockPublishState.synced ? { id: 'party-1', shortCode: 'abc123' } : null,
      };
    },
    sessionState: { mode: 'preparation' },
  };
  const workspaceState = {
    get partyLifecycleState() {
      return mockPublishState.synced ? 'ready' : null;
    },
    get lastSyncedPublishParts() {
      return mockPublishState.synced ? { playlist: 'items', metadata: 'details' } : null;
    },
    serverUnreachable: false,
    isPublishing: false,
    isTransitioningLifecycle: false,
  };
  const settingsState = { streamingSource: 'cherryPlayPlayer' };
  const layoutState = { setLayoutPreset: jest.fn() };
  const playerState = { status: 'idle' };
  const useUIStore = Object.assign(
    (selector: (state: typeof mockUiState) => unknown) => selector(mockUiState),
    { getState: () => mockUiState },
  );
  return {
    useProjectStore: (selector: (state: typeof projectState) => unknown) => selector(projectState),
    usePartyWorkspaceStore: (selector: (state: typeof workspaceState) => unknown) =>
      selector(workspaceState),
    useSettingsStore: (selector: (state: typeof settingsState) => unknown) =>
      selector(settingsState),
    useLayoutStore: (selector: (state: typeof layoutState) => unknown) => selector(layoutState),
    usePlayerAudioStore: (selector: (state: typeof playerState) => unknown) => selector(playerState),
    useAuthStore: (selector: (state: { accessToken: string | null; organizer: object | null }) => unknown) =>
      selector({ accessToken: mockAuthenticated.value ? 'token' : null, organizer: mockAuthenticated.value ? {} : null }),
    useUIStore,
    openPartySettingsModal: jest.fn(),
  };
});

jest.mock('@shared/streaming', () => ({ useOnlineNetworkPolicy: () => ({ networkEnabled: true }) }));
jest.mock('../../../src/workspaces/party/usePartyPublishOutOfSync', () => ({
  usePartyPublishOutOfSync: () => false,
}));
jest.mock('../../../src/workspaces/party/partyHeaderCommands', () => ({
  publishPartyFromHeader: jest.fn(),
  unarchivePartyFromHeader: jest.fn(),
}));
jest.mock('../../../src/workspaces/party/PartyGoToPlayGuidePanel', () => ({
  PartyGoToPlayGuidePanel: () => null,
}));
jest.mock('../../../src/workspaces/party/PartyProgramEndedReminder', () => ({
  PartyProgramEndedReminder: () => null,
}));
jest.mock('../../../src/workspaces/party/partyProgramEndedStore', () => ({
  usePartyProgramEndedStore: (selector: (state: { programEnded: boolean; reminderVisible: boolean; reminderDeadlineMs: number | null }) => unknown) =>
    selector({ programEnded: false, reminderVisible: false, reminderDeadlineMs: null }),
}));
jest.mock('../../../src/workspaces/party/partyWorkspaceStore', () => ({
  usePartyWorkspaceStore: (selector: (state: { partyLifecycleState: 'ready' | null; lastSyncedPublishParts: { playlist: string; metadata: string } | null; serverUnreachable: boolean; isPublishing: boolean; isTransitioningLifecycle: boolean }) => unknown) =>
    selector({
      get partyLifecycleState() {
        return mockPublishState.synced ? 'ready' : null;
      },
      get lastSyncedPublishParts() {
        return mockPublishState.synced ? { playlist: 'items', metadata: 'details' } : null;
      },
      serverUnreachable: false,
      isPublishing: false,
      isTransitioningLifecycle: false,
    }),
}));
jest.mock('../../../src/workspaces/party/partyHeaderGoToPlayGuide', () => ({
  clearPartyHeaderGuideHighlight: jest.fn(),
  findPartyHeaderGuideTarget: jest.fn(),
  PARTY_HEADER_GUIDE_HIGHLIGHT_MS: 1000,
  PARTY_HEADER_GUIDE_TARGET_RESUME: 'resume',
  PARTY_HEADER_GUIDE_TARGET_STOP: 'stop',
  resolvePartyHeaderGuideStartLabel: () => 'Начать',
  resolvePartyHeaderGuideStopLabel: () => 'Остановить',
  resolvePartyHeaderGuideTargetKind: () => 'resume',
  runPartyHeaderGuideHighlight: jest.fn(),
  waitForPartyHeaderGuideTarget: jest.fn(),
}));

import { HeaderPartyStatus } from '@app/components/HeaderPartyStatus';

describe('HeaderPartyStatus party linking', () => {
  beforeEach(() => {
    mockAuthenticated.value = true;
    mockPublishState.synced = false;
    mockOpenModal.mockReset();
    mockAddNotification.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the link-party flow for an authenticated user', () => {
    render(<HeaderPartyStatus />);
    const linkButton = screen.getByRole('button', { name: 'Привязать существующую вечеринку' });
    expect(linkButton).toHaveAttribute('title', 'Привязать существующую вечеринку');
    expect(linkButton).toHaveTextContent('');
    fireEvent.click(linkButton);

    expect(mockOpenModal).toHaveBeenCalledWith('linkParty');
    expect(mockOpenModal).not.toHaveBeenCalledWith('account');
  });

  it('opens the account flow with a sign-in prompt for an unauthenticated user', () => {
    mockAuthenticated.value = false;
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    render(<HeaderPartyStatus />);
    fireEvent.click(screen.getByRole('button', { name: 'Привязать существующую вечеринку' }));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cherryplay:open-account-popover' }),
    );
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'warning',
      message: 'Войдите в аккаунт, чтобы привязать вечеринку.',
    });
  });

  it('shows a matching tooltip and accessible label when publish data is already synced', () => {
    mockPublishState.synced = true;
    render(<HeaderPartyStatus />);

    const publishButton = screen.getByRole('button', {
      name: 'Данные вечеринки уже синхронизированы',
    });

    expect(publishButton).toHaveAttribute('title', 'Данные вечеринки уже синхронизированы');
    expect(publishButton).toBeDisabled();
    expect(publishButton).toHaveClass('header-party-control__icon-button--synced');
  });
});
