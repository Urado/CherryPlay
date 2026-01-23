import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DemoPlayer, DemoPlayerController } from '../../src/components/DemoPlayer';
import type { Track } from '../../src/types/track';

const mockAddNotification = jest.fn();

jest.mock('../../src/state/demoPlayerStore', () => {
  const actual = jest.requireActual('../../src/state/demoPlayerStore');
  return {
    ...actual,
    useDemoPlayerStore: jest.fn(),
  };
});

const { useDemoPlayerStore: mockUseDemoPlayerStore } = jest.requireMock(
  '../../src/state/demoPlayerStore',
) as {
  useDemoPlayerStore: jest.Mock;
};

jest.mock('../../src/state/uiStore', () => ({
  useUIStore: (selector: (state: { addNotification: typeof mockAddNotification }) => unknown) =>
    selector({ addNotification: mockAddNotification }),
}));

const createTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'track-1',
  name: 'Demo Track',
  path: 'file:///demo-track.flac',
  duration: 200,
  ...overrides,
});

const createController = (overrides: Partial<DemoPlayerController> = {}): DemoPlayerController => ({
  currentTrack: null,
  status: 'idle',
  position: 0,
  duration: 0,
  volume: 0.8,
  error: null,
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  seek: jest.fn(),
  setVolume: jest.fn(),
  clear: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  mockUseDemoPlayerStore.mockReturnValue(createController());
  mockAddNotification.mockClear();
});

describe('DemoPlayer component', () => {
  it('shows placeholder when no track is selected', () => {
    const controller = createController();
    render(<DemoPlayer controller={controller} notify={jest.fn()} />);

    expect(screen.getByText('Нет активного трека')).toBeInTheDocument();
    expect(screen.getByTitle('Воспроизвести')).toBeDisabled();
  });

  it('calls play and reports error if promise rejects', async () => {
    const playError = new Error('blocked');
    const controller = createController({
      currentTrack: createTrack(),
      play: jest.fn().mockRejectedValueOnce(playError),
    });
    const notify = jest.fn();
    render(<DemoPlayer controller={controller} notify={notify} />);

    const toggle = screen.getByTitle('Воспроизвести');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(controller.play).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith({
        type: 'error',
        message: 'Не удалось начать воспроизведение. Проверьте настройки аудио.',
      });
    });
  });

  it('calls pause when status is playing', () => {
    const controller = createController({
      status: 'playing',
      currentTrack: createTrack(),
    });
    render(<DemoPlayer controller={controller} notify={jest.fn()} />);

    const toggle = screen.getByTitle('Пауза');
    fireEvent.click(toggle);

    expect(controller.pause).toHaveBeenCalledTimes(1);
  });

  it('calls onShowInBrowser for safe paths', () => {
    const track = createTrack({ path: 'file:///demo-track.flac' });
    const controller = createController({ currentTrack: track });
    const notify = jest.fn();
    const onShow = jest.fn();

    render(<DemoPlayer controller={controller} notify={notify} onShowInBrowser={onShow} />);

    const showButton = screen.getByRole('button', { name: 'Показать в браузере' });
    fireEvent.click(showButton);

    expect(onShow).toHaveBeenCalledWith(track.path);
    expect(notify).not.toHaveBeenCalled();
  });

  it('blocks unsafe paths when requesting show in browser', () => {
    const track = createTrack({ path: 'http://malicious' });
    const controller = createController({ currentTrack: track });
    const notify = jest.fn();
    const onShow = jest.fn();

    render(<DemoPlayer controller={controller} notify={notify} onShowInBrowser={onShow} />);

    const showButton = screen.getByRole('button', { name: 'Показать в браузере' });
    fireEvent.click(showButton);

    expect(onShow).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({
      type: 'error',
      message: 'Путь к файлу выглядит небезопасным, действие отменено.',
    });
  });

  it('clears controller resources on unmount', () => {
    const controller = createController({
      currentTrack: createTrack(),
    });
    const notify = jest.fn();
    const { unmount } = render(<DemoPlayer controller={controller} notify={notify} />);

    unmount();

    expect(controller.clear).toHaveBeenCalledTimes(1);
  });
});
