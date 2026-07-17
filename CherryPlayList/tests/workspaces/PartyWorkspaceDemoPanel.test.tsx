import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@cherryplay/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      React.createElement('button', { type: 'button', ...props }, props.children),
  };
});

import { PartyWorkspaceDemoPanel } from '../../src/workspaces/party/PartyWorkspaceDemoPanel';

jest.mock('../../src/workspaces/party/PartyWorkspaceDemoPanel.css', () => ({}));

jest.mock('../../src/workspaces/party/components/PartyPreviewScenarioControls', () => ({
  PartyPreviewScenarioControls: () => <div data-testid="preview-scenario-controls" />,
}));

jest.mock('../../src/workspaces/party/partyPreviewScenarioActions', () => ({
  syncPreviewWithProduction: jest.fn(),
}));

jest.mock('../../src/workspaces/party/partyWorkspaceDemoActions', () => ({
  demoResetToDefault: jest.fn(),
  demoSetBlockedOverride: jest.fn(),
  demoSetLinkedLifecycle: jest.fn(),
  demoSetPartyNotFound: jest.fn(),
  demoSetUnlinkedDraft: jest.fn(),
}));

describe('PartyWorkspaceDemoPanel', () => {
  it('hides «Сброс демо» in preview mode when showDemoReset is false', () => {
    render(<PartyWorkspaceDemoPanel mode="preview" showDemoReset={false} />);

    expect(screen.queryByRole('button', { name: 'Сброс демо' })).not.toBeInTheDocument();
    expect(screen.getByTestId('preview-scenario-controls')).toBeInTheDocument();
  });

  it('shows «Сброс демо» in preview mode when showDemoReset is true', () => {
    render(<PartyWorkspaceDemoPanel mode="preview" showDemoReset />);

    expect(screen.getByRole('button', { name: 'Сброс демо' })).toBeInTheDocument();
  });
});
