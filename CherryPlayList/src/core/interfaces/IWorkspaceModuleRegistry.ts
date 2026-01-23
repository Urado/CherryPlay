import React from 'react';

import { WorkspaceId } from '../types/workspace';

import { IWorkspaceModule } from './IWorkspaceModule';

export interface IWorkspaceModuleRegistry {
  register: (module: IWorkspaceModule) => void;
  unregister: (id: WorkspaceId) => void;
  getModule: (id: WorkspaceId) => IWorkspaceModule | undefined;
  getModuleByType: (type: string) => IWorkspaceModule | undefined;
  renderWorkspace: (workspaceId: WorkspaceId, zoneId: string) => React.ReactNode;
}
