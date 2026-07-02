import React from 'react';

import { getAppMode } from '@shared/platform';
import { useSettingsStore } from '@shared/stores';

import { PartyWorkspaceRuntimeProvider } from './partyWorkspaceRuntimeContext';
import './PartyViewWrapper.css';

interface PartyStreamingGateProps {
  children: React.ReactNode;
}

export const PartyStreamingGate: React.FC<PartyStreamingGateProps> = ({ children }) => {
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

  return <PartyWorkspaceRuntimeProvider>{children}</PartyWorkspaceRuntimeProvider>;
};
