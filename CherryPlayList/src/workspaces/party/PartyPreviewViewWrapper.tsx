import React from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { getAppMode } from '@shared/platform';
import { useSettingsStore } from '@shared/stores';

import { PartyPreviewView } from './PartyPreviewView';
import './PartyViewWrapper.css';

interface PartyPreviewViewWrapperProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PartyPreviewViewWrapper: React.FC<PartyPreviewViewWrapperProps> = (props) => {
  const { enableStreaming } = useSettingsStore();
  const isDemoMode = getAppMode() === 'demo';

  if (!enableStreaming) {
    return (
      <div className="party-view-wrapper-disabled">
        <div className="party-view-wrapper-message">
          {isDemoMode ? (
            <>
              <p>Трансляция отключена</p>
              <p>Включите «Стриминг» в настройках или используйте layout с Party в демо.</p>
            </>
          ) : (
            <>
              <p>Стриминг отключён</p>
              <p>Для начала стриминга включите его в настройках</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return <PartyPreviewView {...props} showDemoPanel={isDemoMode} />;
};
