import React, { useEffect } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { useSettingsStore } from '@shared/stores';

import { PlayerViewContainer } from './PlayerViewContainer';

interface LegacyAimpWorkspaceAdapterProps {
  zoneId: string;
}

/** Unmigrated layouts may still reference workspace:aimp — route through unified player shell. */
export const LegacyAimpWorkspaceAdapter: React.FC<LegacyAimpWorkspaceAdapterProps> = ({
  zoneId,
}) => {
  useEffect(() => {
    const { streamingSource, setStreamingSource } = useSettingsStore.getState();
    if (streamingSource !== 'aimp') {
      setStreamingSource('aimp');
    }
  }, []);

  return <PlayerViewContainer workspaceId={DEFAULT_PLAYER_WORKSPACE_ID} zoneId={zoneId} />;
};
