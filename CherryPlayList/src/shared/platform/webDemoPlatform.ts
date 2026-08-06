import { type AimpBridgeState, type AimpSourceSelection } from '../contracts/aimp';

import { DEMO_UNAVAILABLE_MESSAGE, demoUnavailableResponse } from './demoUnavailable';
import { createDemoAimpBridgeState } from './fixtures/demoAimpBridge';
import { getDemoConfigPath, getDemoServerUrl, setDemoServerUrl } from './fixtures/demoConfig';
import {
  handleDemoAnalyzeLoudness,
  handleDemoStatAudioFile,
} from './fixtures/demoLoudnessAnalyzer';
import {
  DEMO_MUSIC_ROOT,
  findDemoAudioFilesRecursive,
  listDemoDirectory,
  resolveDemoPathForFile,
  statDemoPath,
} from './fixtures/fileBrowserTree';
import type { IPCResponse, PlatformAPI } from './types';

const DEMO_DIALOG_FIXTURE_PATH = '/demo/exports/output.cherry';
const DEMO_OPEN_DIALOG_PATH = DEMO_MUSIC_ROOT;

function createDemoAimpApi(): PlatformAPI['aimp'] {
  let state = createDemoAimpBridgeState('cherryPlayPlayer');

  const response = (next: AimpBridgeState): IPCResponse<AimpBridgeState> => ({
    success: true,
    data: next,
  });

  return {
    getState: async () => response(state),
    setSourceSelection: async (sourceSelection: AimpSourceSelection) => {
      state = createDemoAimpBridgeState(sourceSelection, state.liveStreamStarted);
      return response(state);
    },
    setLiveStreamStarted: async (liveStreamStarted: boolean) => {
      state = createDemoAimpBridgeState(state.sourceSelection, liveStreamStarted);
      return response(state);
    },
    onStateChanged: () => () => undefined,
    onLog: () => () => undefined,
  };
}

export class WebDemoPlatform implements PlatformAPI {
  readonly aimp = createDemoAimpApi();

  getPathForFile(file: File): string {
    return resolveDemoPathForFile(file);
  }

  invoke(channel: string, payload?: object): Promise<IPCResponse<unknown>> {
    switch (channel) {
      case 'fileBrowser:listDirectory': {
        const path =
          typeof payload === 'object' &&
          payload !== null &&
          'path' in payload &&
          typeof (payload as { path: unknown }).path === 'string'
            ? (payload as { path: string }).path
            : DEMO_MUSIC_ROOT;
        return Promise.resolve({
          success: true,
          data: listDemoDirectory(path),
        });
      }

      case 'fileBrowser:statFile': {
        const path =
          typeof payload === 'object' &&
          payload !== null &&
          'path' in payload &&
          typeof (payload as { path: unknown }).path === 'string'
            ? (payload as { path: string }).path
            : '';
        const stat = statDemoPath(path);
        if (!stat) {
          return Promise.resolve({
            success: false,
            error: `Path not found: ${path}`,
          });
        }
        return Promise.resolve({ success: true, data: stat });
      }

      case 'fileBrowser:findAudioFilesRecursive': {
        const path =
          typeof payload === 'object' &&
          payload !== null &&
          'path' in payload &&
          typeof (payload as { path: unknown }).path === 'string'
            ? (payload as { path: string }).path
            : DEMO_MUSIC_ROOT;
        return Promise.resolve({
          success: true,
          data: findDemoAudioFilesRecursive(path),
        });
      }

      case 'audio:analyzeLoudness':
        return Promise.resolve(handleDemoAnalyzeLoudness(payload));

      case 'audio:statAudioFile':
        return Promise.resolve(handleDemoStatAudioFile(payload));

      case 'audio:getDuration':
      case 'audio:getFileUrl':
        return Promise.resolve(demoUnavailableResponse());

      case 'project:save':
      case 'project:savePortableAs':
        return Promise.resolve(demoUnavailableResponse());

      case 'project:load':
        return Promise.resolve({
          success: true,
          data: null,
        });

      case 'export:execute':
      case 'export:copyFile':
      case 'export:aimp':
      case 'export:copyTracksToFolder':
        return Promise.resolve({ success: true });

      case 'plugins:list':
        return Promise.resolve({ success: true, data: [] });

      case 'dialog:showOpenDialog':
        return Promise.resolve({
          success: true,
          data: DEMO_OPEN_DIALOG_PATH,
        });

      case 'dialog:showSaveDialog':
      case 'dialog:showOpenFileDialog':
        return Promise.resolve({
          success: true,
          data: DEMO_DIALOG_FIXTURE_PATH,
        });

      case 'system:getPath': {
        const name =
          typeof payload === 'object' &&
          payload !== null &&
          'name' in payload &&
          typeof (payload as { name: unknown }).name === 'string'
            ? (payload as { name: string }).name
            : 'home';
        if (name === 'music') {
          return Promise.resolve({ success: true, data: DEMO_MUSIC_ROOT });
        }
        if (name === 'home') {
          return Promise.resolve({ success: true, data: '/demo' });
        }
        return Promise.resolve({ success: true, data: `/demo/${name}` });
      }

      case 'system:openPath':
      case 'system:openExternal':
        return Promise.resolve({ success: true });

      case 'config:getServerUrl':
        return Promise.resolve({ success: true, data: getDemoServerUrl() });

      case 'config:setServerUrl': {
        const serverUrl =
          typeof payload === 'object' &&
          payload !== null &&
          'serverUrl' in payload &&
          typeof (payload as { serverUrl: unknown }).serverUrl === 'string'
            ? (payload as { serverUrl: string }).serverUrl
            : getDemoServerUrl();
        setDemoServerUrl(serverUrl);
        return Promise.resolve({ success: true, data: serverUrl });
      }

      case 'config:getConfigPath':
        return Promise.resolve({ success: true, data: getDemoConfigPath() });

      case 'config:getConfig':
        return Promise.resolve({
          success: true,
          data: { serverUrl: getDemoServerUrl() },
        });

      case 'auth:openExternal': {
        const url =
          typeof payload === 'object' &&
          payload !== null &&
          'url' in payload &&
          typeof (payload as { url: unknown }).url === 'string'
            ? (payload as { url: string }).url
            : undefined;
        if (url && typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        return Promise.resolve({ success: true });
      }

      case 'auth:registerCallback':
        return Promise.resolve({
          success: false,
          error: DEMO_UNAVAILABLE_MESSAGE,
        });

      default:
        return demoUnavailableResponse();
    }
  }

  on(): () => void {
    return () => undefined;
  }
}
