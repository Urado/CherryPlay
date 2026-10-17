import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { PartyPreviewDisplayPanel } from '../../src/workspaces/party/PartyPreviewDisplayPanel';

const formState = {
  groupDisplayDepth: 3,
  setGroupDisplayDepth: jest.fn(),
};

jest.mock('../../src/workspaces/party/partyWorkspaceRuntimeContext', () => ({
  usePartyWorkspaceRuntimeContext: () => ({}),
}));

jest.mock('../../src/workspaces/party/usePartySettingsFormState', () => ({
  usePartySettingsFormState: () => formState,
}));

describe('PartyPreviewDisplayPanel accordions', () => {
  it('renders one expanded accordion for group depth', () => {
    render(<PartyPreviewDisplayPanel themeId="basic" />);

    const depthToggle = screen.getByRole('button', { name: 'Глубина групп' });

    expect(depthToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: 'Отображение треков' })).not.toBeInTheDocument();

    expect(screen.getByLabelText('Уровень вложенности')).toBeVisible();
    expect(screen.queryByText('Скрыть символы с начала имени трека')).not.toBeInTheDocument();
  });

  it('keeps group depth accordion expanded for spring theme while hiding depth controls', () => {
    render(<PartyPreviewDisplayPanel themeId="spring-cross-step" />);

    expect(screen.getByRole('button', { name: 'Глубина групп' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.queryByLabelText('Уровень вложенности')).not.toBeInTheDocument();
    expect(screen.getByText(/не применяется к теме/)).toBeVisible();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
