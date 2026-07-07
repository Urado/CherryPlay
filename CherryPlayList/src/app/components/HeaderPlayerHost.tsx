import React from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { useLayoutStore, useSettingsStore } from '@shared/stores';
import { PlayerViewContainer } from '@workspaces/player/components/PlayerViewContainer';

const HEADER_PLAYER_ZONE_ID = 'app-header-player-zone';

export const HeaderPlayerHost: React.FC = () => {
  const playerInAppHeader = useSettingsStore((state) => state.playerInAppHeader);
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);

  if (!playerInAppHeader) {
    return null;
  }

  return (
    <div
      className={`app-header-player-host${isLayoutEditMode ? ' app-header-player-host--blocked' : ''}`}
    >
      <PlayerViewContainer
        workspaceId={DEFAULT_PLAYER_WORKSPACE_ID}
        zoneId={HEADER_PLAYER_ZONE_ID}
        variant="header"
      />
    </div>
  );
};
