import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

const useBrowserLoginMock = jest.fn();

jest.mock('@shared/hooks/useBrowserLogin', () => ({
  useBrowserLogin: () => useBrowserLoginMock(),
}));

jest.mock('@cherryplay/components', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) =>
      ReactActual.createElement('button', { type: 'button', ...props }, children),
  };
});

jest.mock('@shared/components', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Spinner: ({ size }: { size?: string }) =>
      ReactActual.createElement('div', { 'data-testid': 'spinner', 'data-size': size }),
  };
});

import { BrowserLoginPanel } from '@app/components/BrowserLoginPanel';

describe('BrowserLoginPanel', () => {
  const startLogin = jest.fn();
  const retryLogin = jest.fn();
  const cancelWaiting = jest.fn();

  beforeEach(() => {
    startLogin.mockReset();
    retryLogin.mockReset();
    cancelWaiting.mockReset();
  });

  it('idle: shows «Войти через браузер»', () => {
    useBrowserLoginMock.mockReturnValue({
      isWaiting: false,
      error: null,
      startLogin,
      retryLogin,
      cancelWaiting,
    });

    render(<BrowserLoginPanel />);

    expect(screen.getByRole('button', { name: 'Войти через браузер' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Войти через браузер' }));
    expect(startLogin).toHaveBeenCalledTimes(1);
  });

  it('waiting: spinner + «Отмена»', () => {
    useBrowserLoginMock.mockReturnValue({
      isWaiting: true,
      error: null,
      startLogin,
      retryLogin,
      cancelWaiting,
    });

    render(<BrowserLoginPanel />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText('Завершите вход в открывшемся браузере…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(cancelWaiting).toHaveBeenCalledTimes(1);
  });

  it('failed: alert + «Попробовать снова»', () => {
    useBrowserLoginMock.mockReturnValue({
      isWaiting: false,
      error: 'Не удалось открыть браузер',
      startLogin,
      retryLogin,
      cancelWaiting,
    });

    render(<BrowserLoginPanel />);

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось открыть браузер');
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    expect(retryLogin).toHaveBeenCalledTimes(1);
  });
});
