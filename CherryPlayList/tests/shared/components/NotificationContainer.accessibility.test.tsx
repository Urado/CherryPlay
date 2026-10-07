const mockNotifications = [{ id: 'notice-1', type: 'success', message: 'Добавлен следующим' }];

jest.mock('../../../src/shared/stores/uiStore', () => ({
  useUIStore: (
    selector?: (state: { notifications: typeof mockNotifications; removeNotification: () => void }) => unknown,
  ) => {
    const state = { notifications: mockNotifications, removeNotification: jest.fn() };
    return selector ? selector(state) : state;
  },
}));

import { render, screen } from '@testing-library/react';

import { NotificationContainer } from '../../../src/shared/components/NotificationContainer';

describe('NotificationContainer live announcements', () => {
  it('announces notification text through a polite status region', () => {
    render(<NotificationContainer />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Добавлен следующим')).toBeInTheDocument();
  });
});
