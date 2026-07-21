import React from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { useSettingsStore } from '@shared/stores';
import { AimpView } from '@workspaces/aimp/AimpView';

import { PlayerViewContainerContent } from './PlayerViewContainerContent';

interface PlayerViewContainerProps {
  workspaceId: WorkspaceId;
  zoneId: string;
  variant?: 'full' | 'header';
}

export const PlayerViewContainer: React.FC<PlayerViewContainerProps> = ({
  workspaceId,
  zoneId,
  variant = 'full',
}) => {
  const streamingSource = useSettingsStore((state) => state.streamingSource);

  return (
    <div
      className={`playback-workspace${variant === 'header' ? ' playback-workspace--header' : ''}`}
    >
      {streamingSource === 'aimp' ? (
        <AimpView workspaceId={workspaceId} zoneId={zoneId} embedded />
      ) : (
        <PlayerViewContainerContent workspaceId={workspaceId} zoneId={zoneId} variant={variant} />
      )}
    </div>
  );
};
