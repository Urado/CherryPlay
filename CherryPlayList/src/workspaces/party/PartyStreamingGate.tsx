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
              <p>Онлайн отключён</p>
              <p>Включите онлайн в настройках или работайте локально с проектом.</p>
            </>
          ) : (
            <>
              <p>Онлайн отключён</p>
              <p>Включите онлайн в настройках, чтобы открыть настройку вечеринки.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return <PartyWorkspaceRuntimeProvider>{children}</PartyWorkspaceRuntimeProvider>;
};
