import React from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { useSettingsStore } from '@shared/stores';
import { AimpView } from '@workspaces/aimp/AimpView';

import { PlayerViewContainerContent } from './PlayerViewContainerContent';

interface PlayerViewContainerProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PlayerViewContainer: React.FC<PlayerViewContainerProps> = ({
  workspaceId,
  zoneId,
}) => {
  const streamingSource = useSettingsStore((state) => state.streamingSource);

  return (
    <div className="playback-workspace">
      {streamingSource === 'aimp' ? (
        <AimpView workspaceId={workspaceId} zoneId={zoneId} embedded />
      ) : (
        <PlayerViewContainerContent workspaceId={workspaceId} zoneId={zoneId} />
      )}
    </div>
  );
};
