import { type CustomizationSettings, type PartyThemeId } from '@cherryplay/components';
import React from 'react';

import { WorkspaceId } from '@core/types/workspace';

import { PartyPreview } from './PartyPreview';
import './PartyPreviewView.css';
import { usePartyWorkspaceRuntime } from './usePartyWorkspace';

interface PartyPreviewViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PartyPreviewView: React.FC<PartyPreviewViewProps> = ({
  workspaceId: _workspaceId,
  zoneId: _zoneId,
}) => {
  const {
    partyName,
    partyTitle,
    partySubtitle,
    themeId,
    customizationSettings,
    previewPlaylistData,
    playbackState,
    partyLifecycleState,
    meta,
  } = usePartyWorkspaceRuntime();

  const previewLifecycleState = meta.linkedParty ? partyLifecycleState : null;

  return (
    <div className="party-preview-view">
      <div className="party-preview-view-header">
        <h2>Превью (как будет выглядеть в браузере)</h2>
      </div>
      <div className="party-preview-view-content">
        <PartyPreview
          playlist={previewPlaylistData}
          themeId={themeId}
          customizationSettings={customizationSettings as CustomizationSettings<PartyThemeId>}
          playbackState={playbackState}
          partyName={partyTitle.trim() || partyName || 'Превью вечеринки'}
          subtitle={partySubtitle.trim() || undefined}
          previewLifecycleState={previewLifecycleState}
        />
      </div>
    </div>
  );
};
