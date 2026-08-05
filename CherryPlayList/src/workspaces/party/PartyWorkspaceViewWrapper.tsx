import React from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { getAppMode, isDemoFixturesMode } from '@shared/platform';

import { PartyEditorView } from './PartyEditorView';
import { PartyPreviewView } from './PartyPreviewView';
import { PartyStreamingGate } from './PartyStreamingGate';

type PartyWorkspaceView = 'editor' | 'preview';

interface PartyWorkspaceViewWrapperProps {
  workspaceId: WorkspaceId;
  zoneId: string;
  view: PartyWorkspaceView;
}

export const PartyWorkspaceViewWrapper: React.FC<PartyWorkspaceViewWrapperProps> = ({
  view,
  ...props
}) => {
  const showDemoPanel = isDemoFixturesMode(getAppMode());

  return (
    <PartyStreamingGate>
      {view === 'editor' ? (
        <PartyEditorView {...props} showDemoPanel={showDemoPanel} />
      ) : (
        <PartyPreviewView {...props} showDemoPanel={showDemoPanel} />
      )}
    </PartyStreamingGate>
  );
};
