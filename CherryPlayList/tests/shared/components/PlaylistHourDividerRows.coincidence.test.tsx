import { render, screen } from '@testing-library/react';
import React from 'react';

import {
  HourDividerAfterTrackRow,
  HourDividerListBottom,
} from '../../../src/shared/components/PlaylistHourDividerRows';

describe('HourDividerAfterTrackRow coincidence', () => {
  it('renders one marker with both captions when plan and queue share a row', () => {
    render(
      <HourDividerAfterTrackRow
        hasPlannedEndDivider
        hasQueueEndDivider
        showIntervalDivider
        intervalTrackId="t1"
        formatPlannedEndTimelineLabel={() => 'План 01:00:00'}
        formatQueueEndTimelineLabel={() => 'Конец 01:00:00'}
        formatDividerLabel={() => '01:00:00'}
      />,
    );

    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(
      screen.getByRole('separator', { name: 'План 01:00:00, Конец 01:00:00' }),
    ).toBeInTheDocument();
    expect(screen.getByText('План 01:00:00')).toBeInTheDocument();
    expect(screen.getByText('Конец 01:00:00')).toBeInTheDocument();
  });

  it('renders a single-kind divider when they do not coincide', () => {
    render(
      <HourDividerAfterTrackRow
        hasPlannedEndDivider
        hasQueueEndDivider={false}
        showIntervalDivider
        intervalTrackId="t1"
        formatPlannedEndTimelineLabel={() => 'План 01:00:00'}
        formatQueueEndTimelineLabel={() => 'Конец 01:00:00'}
        formatDividerLabel={() => '01:00:00'}
      />,
    );

    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(screen.getByRole('separator', { name: 'План 01:00:00' })).toBeInTheDocument();
    expect(screen.queryByText('Конец 01:00:00')).not.toBeInTheDocument();
  });
});

describe('HourDividerListBottom coincidence', () => {
  it('renders one marker with both captions at list bottom', () => {
    render(
      <HourDividerListBottom
        showPlannedEndDividerAtListBottom
        displayItemsLength={3}
        showQueueEndDividerAtListBottom
        formatPlannedEndTimelineLabel={() => 'План 02:00:00'}
        formatQueueEndTimelineLabel={() => 'Конец 02:00:00'}
      />,
    );

    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(
      screen.getByRole('separator', { name: 'План 02:00:00, Конец 02:00:00' }),
    ).toBeInTheDocument();
    expect(screen.getByText('План 02:00:00')).toBeInTheDocument();
    expect(screen.getByText('Конец 02:00:00')).toBeInTheDocument();
  });
});
