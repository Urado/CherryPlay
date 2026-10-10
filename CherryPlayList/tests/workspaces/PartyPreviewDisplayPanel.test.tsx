import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { PartyPreviewDesignNav } from '../../src/workspaces/party/components/PartyPreviewDesignNav';
import { PartyPreviewDisplayPanel } from '../../src/workspaces/party/PartyPreviewDisplayPanel';
import {
  resetPartySettingsUiState,
  usePartySettingsUiStore,
} from '../../src/workspaces/party/partySettingsUiStore';

jest.mock('../../src/workspaces/party/partyWorkspaceRuntimeContext', () => ({
  usePartyWorkspaceRuntimeContext: () => ({}),
}));

jest.mock('../../src/workspaces/party/usePartySettingsFormState', () => ({
  usePartySettingsFormState: () => ({
    groupDisplayDepth: 3,
    setGroupDisplayDepth: jest.fn(),
    showTrackDisplay: true,
    partyTrackDisplay: {},
    setPartyTrackDisplaySettings: jest.fn(),
  }),
}));

jest.mock('../../src/workspaces/party/components/PartyTrackDisplaySection', () => ({
  PartyTrackDisplaySection: () => <div data-testid="track-display-settings" />,
}));

describe('party preview display settings', () => {
  beforeEach(() => resetPartySettingsUiState());

  it('provides compact, accessible navigation linked to each panel', () => {
    render(
      <PartyPreviewDesignNav
        open={false}
        displayOpen={false}
        onToggle={jest.fn()}
        onDisplayToggle={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Открыть дизайн' })).toHaveAttribute(
      'aria-controls',
      'party-preview-design-panel',
    );
    expect(screen.getByRole('button', { name: 'Открыть отображение' })).toHaveAttribute(
      'aria-controls',
      'party-preview-display-panel',
    );
    expect(screen.getByRole('button', { name: 'Открыть отображение' })).not.toHaveTextContent(
      'Отображение',
    );
  });

  it('keeps design and display panels mutually exclusive', () => {
    const state = usePartySettingsUiStore.getState();

    state.togglePreviewDesignOpen();
    expect(usePartySettingsUiStore.getState()).toMatchObject({
      previewDesignOpen: true,
      previewDisplayOpen: false,
    });

    usePartySettingsUiStore.getState().togglePreviewDisplayOpen();
    expect(usePartySettingsUiStore.getState()).toMatchObject({
      previewDesignOpen: false,
      previewDisplayOpen: true,
    });
  });

  it('shows configurable depth and track trimming for common themes', () => {
    render(<PartyPreviewDisplayPanel themeId="basic" />);

    expect(screen.getByLabelText('Уровень вложенности')).toHaveValue('3');
    expect(screen.getByTestId('track-display-settings')).toBeInTheDocument();
  });

  it('keeps Spring depth unavailable while retaining track display settings', () => {
    render(<PartyPreviewDisplayPanel themeId="spring-cross-step" />);

    expect(screen.queryByLabelText('Уровень вложенности')).not.toBeInTheDocument();
    expect(screen.getByText(/не применяется к теме/)).toBeInTheDocument();
    expect(screen.getByTestId('track-display-settings')).toBeInTheDocument();
  });
});
