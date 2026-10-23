import { renderHook } from '@testing-library/react';

import type { PartyWorkspaceRuntimeValue } from '../../src/workspaces/party/partyWorkspaceRuntimeContext';
import { usePartySettingsFormState } from '../../src/workspaces/party/usePartySettingsFormState';

jest.mock('../../src/shared/stores', () => ({
  useProjectStore: (select: (state: unknown) => unknown) =>
    select({ sessionState: { mode: 'preparation' } }),
  usePlayerAudioStore: (select: (state: unknown) => unknown) => select({ status: 'stopped' }),
  useSettingsStore: (select: (state: unknown) => unknown) =>
    select({ streamingSource: 'cherryPlayPlayer' }),
  useAimpStore: (select: (state: unknown) => unknown) => select({ bridgeState: {} }),
}));

jest.mock('../../src/shared/streaming', () => ({
  useOnlineNetworkPolicy: () => ({ networkEnabled: true }),
}));

const createRuntime = (overrides: Partial<PartyWorkspaceRuntimeValue> = {}) =>
  ({
    isAuth: true,
    isClientOutdated: false,
    isCheckingParty: false,
    meta: {},
    partyLifecycleState: null,
    serverError: null,
    lockedThemeInfos: [],
    themeAccess: null,
    ...overrides,
  }) as PartyWorkspaceRuntimeValue;

describe('party settings form availability', () => {
  it('keeps the unlinked form and Create action visible before authentication', () => {
    const { result } = renderHook(() =>
      usePartySettingsFormState(createRuntime({ isAuth: false })),
    );

    expect(result.current.editorPhase).toBe('draft-unlinked');
    expect(result.current).not.toHaveProperty('showTrackDisplay');
    expect(result.current.actionVisibility?.showCreate).toBe(true);
    expect(result.current.actionVisibility?.showLinkParty).toBe(false);
    expect(result.current.isAuth).toBe(false);
    expect(result.current.networkActionsDisabled).toBe(false);
  });

  it.each(['draft', 'ready', 'completed'] as const)(
    'preserves the linked %s form without authentication and blocks server actions',
    (partyLifecycleState) => {
      const { result } = renderHook(() =>
        usePartySettingsFormState(
          createRuntime({
            isAuth: false,
            meta: { linkedParty: { id: 'party-1', shortCode: 'abc123' } },
            partyLifecycleState,
          }),
        ),
      );

      expect(result.current.editorPhase).toBe(
        partyLifecycleState === 'draft' ? 'draft-linked' : partyLifecycleState,
      );
      expect(result.current.actionVisibility).toBeNull();
      expect(result.current.archiveAvailability.showDangerSection).toBe(false);
    },
  );

  it('keeps the linked form visible while checking and blocks server actions', () => {
    const { result } = renderHook(() =>
      usePartySettingsFormState(
        createRuntime({
          isCheckingParty: true,
          meta: { linkedParty: { id: 'party-1', shortCode: 'abc123' } },
          partyLifecycleState: 'ready',
        }),
      ),
    );

    expect(result.current.editorPhase).toBe('ready');
    expect(result.current.actionVisibility).toBeNull();
    expect(result.current.archiveAvailability.showDangerSection).toBe(false);
  });
});
