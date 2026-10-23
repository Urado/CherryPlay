import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { PartyPreviewDisplayPanel } from '../../src/workspaces/party/PartyPreviewDisplayPanel';

const mockFormState = {
  editorFields: { partyTitle: '', partySubtitle: '' },
  editorHandlers: {
    onPartyTitleChange: jest.fn(),
    onPartySubtitleChange: jest.fn(),
  },
  groupDisplayDepth: 3,
  setGroupDisplayDepth: jest.fn(),
};

jest.mock('../../src/workspaces/party/partyWorkspaceRuntimeContext', () => ({
  usePartyWorkspaceRuntimeContext: () => ({}),
}));

jest.mock('../../src/workspaces/party/usePartySettingsFormState', () => ({
  usePartySettingsFormState: () => mockFormState,
}));

describe('PartyPreviewDisplayPanel accordions', () => {
  it('renders the group settings accordion expanded by default', () => {
    render(<PartyPreviewDisplayPanel themeId="basic" />);

    const groupToggle = screen.getByRole('button', { name: 'Группы' });

    expect(groupToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Уровень вложенности')).toBeVisible();
    expect(screen.getByText('Скрыть символы с начала имени трека')).not.toBeVisible();
  });

  it('keeps group depth accordion expanded for spring theme while hiding depth controls', () => {
    render(<PartyPreviewDisplayPanel themeId="spring-cross-step" />);

    expect(screen.getByRole('button', { name: 'Группы' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.queryByLabelText('Уровень вложенности')).not.toBeInTheDocument();
    expect(screen.getByText(/не применяется к теме/)).toBeVisible();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
