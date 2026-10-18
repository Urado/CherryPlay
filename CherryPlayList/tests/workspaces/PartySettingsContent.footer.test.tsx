import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { PartySettingsContent } from '../../src/workspaces/party/components/PartySettingsContent';
import type { PartyWorkspaceRuntimeValue } from '../../src/workspaces/party/partyWorkspaceRuntimeContext';
import type { usePartySettingsFormState } from '../../src/workspaces/party/usePartySettingsFormState';

let mockForm: ReturnType<typeof usePartySettingsFormState>;

jest.mock('../../src/workspaces/party/usePartySettingsFormState', () => ({
  usePartySettingsFormState: () => mockForm,
}));

jest.mock('../../src/workspaces/party/components/PartyEditor', () => ({
  PartyEditor: ({ aboutActions }: { aboutActions?: React.ReactNode }) => (
    <section aria-label="Поля вечеринки">
      <input aria-label="Название вечеринки" />
      {aboutActions}
    </section>
  ),
}));

describe('party settings persistent actions', () => {
  beforeEach(() => {
    mockForm = {
      editorPhase: 'draft-unlinked',
      isAuth: true,
      isNetworkEnabledForEditor: true,
      isCreating: false,
      isSavingMetadata: false,
      networkActionsDisabled: false,
      archiveAvailability: { showDangerSection: false },
      actionVisibility: {
        showCreate: true,
        showLinkParty: true,
        showSave: false,
        showMakeReady: false,
      },
      handleCreateParty: jest.fn().mockResolvedValue(true),
      handleSaveMetadata: jest.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof usePartySettingsFormState>;
  });

  it('keeps creation and linking outside the form region and closes after successful creation', async () => {
    const onPartyCreated = jest.fn();
    const onOpenLinkParty = jest.fn();
    render(
      <PartySettingsContent
        runtime={{} as PartyWorkspaceRuntimeValue}
        onPartyCreated={onPartyCreated}
        onOpenLinkParty={onOpenLinkParty}
      />,
    );

    const footer = screen.getByRole('contentinfo', { name: 'Действия вечеринки' });
    expect(
      within(screen.getByRole('region', { name: 'Поля вечеринки' })).queryByRole('button'),
    ).not.toBeInTheDocument();
    fireEvent.click(within(footer).getByRole('button', { name: 'Привязать' }));
    expect(onOpenLinkParty).toHaveBeenCalledTimes(1);
    fireEvent.click(within(footer).getByRole('button', { name: 'Создать' }));

    await waitFor(() => expect(onPartyCreated).toHaveBeenCalledTimes(1));
    expect(mockForm.handleCreateParty).toHaveBeenCalledTimes(1);
  });

  it('preserves save actions for a linked party in the footer', () => {
    mockForm.editorPhase = 'ready';
    mockForm.actionVisibility = {
      showCreate: false,
      showLinkParty: true,
      showSave: true,
      showMakeReady: false,
    };
    render(
      <PartySettingsContent
        runtime={{} as PartyWorkspaceRuntimeValue}
        onPartyCreated={jest.fn()}
        onOpenLinkParty={jest.fn()}
      />,
    );

    const footer = screen.getByRole('contentinfo', { name: 'Действия вечеринки' });
    fireEvent.click(within(footer).getByRole('button', { name: 'Обновить' }));

    expect(mockForm.handleSaveMetadata).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Создать' })).not.toBeInTheDocument();
  });
});
