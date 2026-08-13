import React from 'react';

import { useOnlineNetworkPolicy } from '@shared/streaming';

import { PartyConnectivityBanner } from './components/PartyConnectivityBanner';
import { usePartyWorkspaceRuntimeContext } from './partyWorkspaceRuntimeContext';

import './PartyEditorView.css';

interface PartyEditorViewProps {
  workspaceId: string;
  zoneId: string;
  showDemoPanel?: boolean;
}

export const PartyEditorView: React.FC<PartyEditorViewProps> = ({ showDemoPanel = false }) => {
  const { networkEnabled } = useOnlineNetworkPolicy();
  const isNetworkEnabledForEditor = showDemoPanel ? true : networkEnabled;
  const runtime = usePartyWorkspaceRuntimeContext();
  const { serverUnreachable, isReconnecting, lastManualCheckFailed, handleManualReconnect } =
    runtime;

  const connectivityBanner = !isNetworkEnabledForEditor ? (
    <PartyConnectivityBanner kind="offline" />
  ) : serverUnreachable ? (
    <PartyConnectivityBanner
      kind="unreachable"
      isReconnecting={isReconnecting}
      lastManualCheckFailed={lastManualCheckFailed}
      onManualReconnect={handleManualReconnect}
    />
  ) : null;

  return (
    <div className="party-editor-view party-editor-view-stub">
      {connectivityBanner}
      <h2>Настройка вечеринки</h2>
      <p className="party-editor-view-stub__message">
        Настройки вечеринки открываются в окне по кнопке ⚙ в шапке или через CTA на пульте
        («Создать», «К настройкам»).
      </p>
    </div>
  );
};
