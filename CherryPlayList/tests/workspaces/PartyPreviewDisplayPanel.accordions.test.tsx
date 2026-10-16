import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { PartyPreviewDisplayPanel } from '../../src/workspaces/party/PartyPreviewDisplayPanel';

const formState = {
  groupDisplayDepth: 3,
  setGroupDisplayDepth: jest.fn(),
  showTrackDisplay: true,
  partyTrackDisplay: {},
  setPartyTrackDisplaySettings: jest.fn(),
};

jest.mock('../../src/workspaces/party/partyWorkspaceRuntimeContext', () => ({
  usePartyWorkspaceRuntimeContext: () => ({}),
}));

jest.mock('../../src/workspaces/party/usePartySettingsFormState', () => ({
  usePartySettingsFormState: () => formState,
}));

describe('PartyPreviewDisplayPanel accordions', () => {
  beforeEach(() => {
    formState.showTrackDisplay = true;
  });

  it('renders two expanded accordions for group depth then track display', () => {
    render(<PartyPreviewDisplayPanel themeId="basic" />);

    const depthToggle = screen.getByRole('button', { name: 'Глубина групп' });
    const trackToggle = screen.getByRole('button', { name: 'Отображение треков' });

    expect(depthToggle).toHaveAttribute('aria-expanded', 'true');
    expect(trackToggle).toHaveAttribute('aria-expanded', 'true');

    const toggles = screen.getAllByRole('button');
    expect(toggles[0]).toBe(depthToggle);
    expect(toggles[1]).toBe(trackToggle);

    expect(screen.getByLabelText('Уровень вложенности')).toBeVisible();
    expect(screen.getByText('Скрыть символы с начала имени трека')).toBeVisible();
    expect(screen.getByText('Число символов')).toBeVisible();
    expect(screen.getByText('Пример:')).toBeVisible();
  });

  it('keeps both accordions expanded for spring theme while hiding depth controls', () => {
    render(<PartyPreviewDisplayPanel themeId="spring-cross-step" />);

    expect(screen.getByRole('button', { name: 'Глубина групп' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Отображение треков' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.queryByLabelText('Уровень вложенности')).not.toBeInTheDocument();
    expect(screen.getByText(/не применяется к теме/)).toBeVisible();
    expect(screen.getByRole('checkbox')).toBeVisible();
  });

  it('hides the track display accordion when showTrackDisplay is false', () => {
    formState.showTrackDisplay = false;
    render(<PartyPreviewDisplayPanel themeId="basic" />);

    expect(screen.getByRole('button', { name: 'Глубина групп' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отображение треков' })).not.toBeInTheDocument();
    expect(screen.queryByText('Скрыть символы с начала имени трека')).not.toBeInTheDocument();
  });
});
