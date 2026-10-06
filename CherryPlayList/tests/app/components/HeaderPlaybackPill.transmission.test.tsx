import '@testing-library/jest-dom';
import { HubConnectionState } from '@microsoft/signalr';
import { render, screen } from '@testing-library/react';

const mockConnection = { state: HubConnectionState.Connected };

jest.mock('@app/components/CherryPlayStreamingController', () => ({
  useCherryPlayStreamingConnection: () => ({
    connectionState: mockConnection.state,
    reconnect: jest.fn(),
  }),
}));
jest.mock('@shared/components', () => ({ StreamingConnectionIndicator: () => null }));
jest.mock('@shared/streaming', () => ({ useOnlineNetworkPolicy: () => ({ networkEnabled: true }) }));
jest.mock('@shared/utils/durationUtils', () => ({ formatPlayerTime: () => '0:00' }));
jest.mock('@shared/utils/togglePlayPause', () => ({ togglePlayPause: jest.fn() }));
jest.mock('@shared/stores', () => {
  const projectState = { meta: { linkedParty: { id: 'party-1' } }, sessionState: { mode: 'session' } };
  const settingsState = { streamingSource: 'cherryPlayPlayer' };
  const playerState = {
    currentTrack: { name: 'Example track', duration: 180 },
    status: 'playing',
    position: 15,
    duration: 180,
    error: null,
    play: jest.fn(),
    pause: jest.fn(),
  };
  return {
    useProjectStore: (selector: (state: typeof projectState) => unknown) => selector(projectState),
    useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
    usePlayerAudioStore: (selector: (state: typeof playerState) => unknown) => selector(playerState),
  };
});

import { HeaderPlaybackPill } from '@app/components/HeaderPlaybackPill';

describe('HeaderPlaybackPill transmission status', () => {
  beforeEach(() => {
    mockConnection.state = HubConnectionState.Connected;
  });

  it('labels the connected hub state', () => {
    render(<HeaderPlaybackPill />);

    const transmission = screen.getByText('Связь есть');
    expect(transmission).toHaveAttribute('data-state', 'connected');
    expect(transmission).toHaveAttribute('title', 'Связь есть');
  });

  it('shows the pending state while connecting', () => {
    mockConnection.state = HubConnectionState.Connecting;
    render(<HeaderPlaybackPill />);

    expect(screen.getByText('Подключение')).toHaveAttribute('data-state', 'connecting');
  });
});
