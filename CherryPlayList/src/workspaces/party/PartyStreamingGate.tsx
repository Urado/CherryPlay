import React from 'react';

import { PartyWorkspaceRuntimeProvider } from './partyWorkspaceRuntimeContext';

interface PartyStreamingGateProps {
  children: React.ReactNode;
}

/** Mounts Party runtime; connectivity stubs live inside editor/preview zones. */
export const PartyStreamingGate: React.FC<PartyStreamingGateProps> = ({ children }) => {
  return <PartyWorkspaceRuntimeProvider>{children}</PartyWorkspaceRuntimeProvider>;
};
