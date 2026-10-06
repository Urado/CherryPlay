import type { AimpBridgeState, AimpLogEntry, AimpSourceSelection } from '../contracts/aimp';

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export type AppMode = 'electron' | 'demo' | 'capacitor';

export type InvokeChannel =
  | 'fileBrowser:listDirectory'
  | 'fileBrowser:statFile'
  | 'fileBrowser:findAudioFilesRecursive'
  | 'audio:getDuration'
  | 'audio:getFileUrl'
  | 'audio:analyzeLoudness'
  | 'audio:statAudioFile'
  | 'export:execute'
  | 'export:copyFile'
  | 'export:aimp'
  | 'export:copyTracksToFolder'
  | 'project:save'
  | 'project:savePortableAs'
  | 'project:load'
  | 'plugins:list'
  | 'dialog:showOpenDialog'
  | 'dialog:showSaveDialog'
  | 'dialog:showOpenFileDialog'
  | 'system:getPath'
  | 'system:openPath'
  | 'system:openExternal'
  | 'legal:openDocument'
  | 'system:setMinimumWindowSize'
  | 'config:getConfigPath'
  | 'config:getServerUrl'
  | 'config:getWebBaseUrl'
  | 'config:setServerUrl'
  | 'config:getConfig'
  | 'auth:openExternal'
  | 'auth:registerCallback'
  | 'auth:cancelCallback'
  | 'auth:deliverCallbackUrl';

export type OnChannel = 'project:save-progress';

export type {
  LoudnessAnalyzeError,
  LoudnessAnalyzeOk,
  LoudnessAnalyzeResult,
} from '../contracts/loudness';

export type AudioFileStat = {
  mtimeMs: number;
  size: number;
};

export interface MinimumWindowSize {
  minWidth: number;
  minHeight: number;
}

export interface PlatformAimpApi {
  getState: () => Promise<IPCResponse<AimpBridgeState>>;
  setSourceSelection: (
    sourceSelection: AimpSourceSelection,
  ) => Promise<IPCResponse<AimpBridgeState>>;
  setLiveStreamStarted: (liveStreamStarted: boolean) => Promise<IPCResponse<AimpBridgeState>>;
  onStateChanged: (listener: (state: AimpBridgeState) => void) => () => void;
  onLog: (listener: (entry: AimpLogEntry) => void) => () => void;
}

export interface PlatformAPI {
  getPathForFile: (file: File) => string;
  invoke: (channel: string, payload?: object) => Promise<IPCResponse<unknown>>;
  on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => () => void;
  aimp: PlatformAimpApi;
}
