import { DEFAULT_FILEBROWSER_WORKSPACE_ID } from '@core/constants/workspace';
import type { Layout } from '@core/types/layout';
import type { WorkspaceId } from '@core/types/workspace';
import type {
  ActiveWorkspace,
  BuiltinLayoutOverrides,
  UserWorkspace,
} from '@core/types/workspacePreset';
import { APP_VERSION } from '@shared/config/appVersion';
import { getPlatformCapabilities } from '@shared/platform/platformCapabilities';

import type { AimpSourceSelection } from '../contracts/aimp';
import {
  clampLoudnessQuietGapRangeLu,
  clampLoudnessTargetLufs,
  DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
  DEFAULT_LOUDNESS_TARGET_LUFS,
} from '../contracts/loudness';
import type { CustomKeyBindings } from '../shortcuts/shortcutTypes';
import { normalizeBuiltinLayoutOverrides, useLayoutStore } from '../stores/layoutStore';
import { migrateFileBrowserPathsOnRehydrate, useSettingsStore } from '../stores/settingsStore';
import { isTrackItemSizePreset, type TrackItemSizePreset } from '../types/trackItemSize';

import { ipcService } from './ipcService';

export const SETTINGS_EXPORT_SCHEMA_VERSION = 1 as const;
export const SETTINGS_EXPORT_BUNDLE_FILENAME = 'cherryplaylist-settings-bundle.json';

const JSON_FILE_FILTERS = [{ name: 'JSON файлы', extensions: ['json'] }];

function cloneLayout(layout: Layout): Layout {
  return JSON.parse(JSON.stringify(layout)) as Layout;
}

const AUTH_FIELD_KEYS = ['accessToken', 'organizer', 'refreshToken'] as const;

export interface SettingsExportPersistedState {
  exportPath: string;
  exportStrategy: 'copyWithNumberPrefix' | 'aimpPlaylist';
  lastOpenedPlaylist: string;
  fileBrowserPath: string;
  fileBrowserPathsByWorkspaceId?: Record<WorkspaceId, string>;
  trackItemSizePreset: TrackItemSizePreset;
  hourDividerInterval: number;
  showHourDividers: boolean;
  playerAudioDeviceId: string | null;
  demoPlayerAudioDeviceId: string | null;
  keyBindings: CustomKeyBindings;
  enableStreaming: boolean;
  streamingSource: AimpSourceSelection;
  loudnessNormalizationEnabled?: boolean;
  loudnessTargetLufs?: number;
  loudnessCompressionEnabled?: boolean;
  loudnessQuietGapRangeLu?: number;
}

export interface SettingsExportBundle {
  schemaVersion: typeof SETTINGS_EXPORT_SCHEMA_VERSION;
  appVersion: string;
  exportedAt: string;
  settings: SettingsExportPersistedState;
  workspaces: {
    userWorkspaces: UserWorkspace[];
    activeWorkspace?: ActiveWorkspace;
    builtinLayoutOverrides?: BuiltinLayoutOverrides;
  };
}

export interface SettingsImportResult {
  settingsFieldCount: number;
  workspacesImported: number;
  workspacesUpdated: number;
}

function coerceFileBrowserPathsByWorkspaceId(
  value: unknown,
): Record<WorkspaceId, string> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const result: Record<WorkspaceId, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key === 'string' && typeof entry === 'string') {
      result[key] = entry;
    }
  }

  return result;
}

export function pickSettingsExportFields(
  state: ReturnType<typeof useSettingsStore.getState>,
): SettingsExportPersistedState {
  const defaultFileBrowserPath = state.getFileBrowserPathForWorkspace(
    DEFAULT_FILEBROWSER_WORKSPACE_ID,
  );

  return {
    exportPath: state.exportPath,
    exportStrategy: state.exportStrategy,
    lastOpenedPlaylist: state.lastOpenedPlaylist,
    fileBrowserPath: defaultFileBrowserPath,
    fileBrowserPathsByWorkspaceId: { ...state.fileBrowserPathsByWorkspaceId },
    trackItemSizePreset: state.trackItemSizePreset,
    hourDividerInterval: state.hourDividerInterval,
    showHourDividers: state.showHourDividers,
    playerAudioDeviceId: state.playerAudioDeviceId,
    demoPlayerAudioDeviceId: state.demoPlayerAudioDeviceId,
    keyBindings: state.keyBindings,
    enableStreaming: state.enableStreaming,
    streamingSource: state.streamingSource,
    loudnessNormalizationEnabled: state.loudnessNormalizationEnabled,
    loudnessTargetLufs: state.loudnessTargetLufs,
    loudnessCompressionEnabled: state.loudnessCompressionEnabled,
    loudnessQuietGapRangeLu: state.loudnessQuietGapRangeLu,
  };
}

export function buildSettingsExportBundle(): SettingsExportBundle {
  const settingsState = useSettingsStore.getState();
  const layoutState = useLayoutStore.getState();

  const activeWorkspace =
    layoutState.activeWorkspace.kind === 'scratch' ? undefined : layoutState.activeWorkspace;

  return {
    schemaVersion: SETTINGS_EXPORT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: pickSettingsExportFields(settingsState),
    workspaces: {
      userWorkspaces: layoutState.userWorkspaces.map((workspace) => ({
        ...workspace,
        layout: cloneLayout(workspace.layout),
      })),
      builtinLayoutOverrides: normalizeBuiltinLayoutOverrides(layoutState.builtinLayoutOverrides),
      ...(activeWorkspace ? { activeWorkspace } : {}),
    },
  };
}

function hasAuthFields(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return AUTH_FIELD_KEYS.some((key) => key in (value as Record<string, unknown>));
}

function isUserWorkspace(value: unknown): value is UserWorkspace {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const workspace = value as Record<string, unknown>;
  return (
    typeof workspace.id === 'string' &&
    typeof workspace.name === 'string' &&
    workspace.layout !== null &&
    typeof workspace.layout === 'object'
  );
}

function isActiveWorkspace(value: unknown): value is ActiveWorkspace {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const active = value as Record<string, unknown>;
  if (active.kind === 'builtin') {
    return typeof active.preset === 'string';
  }
  if (active.kind === 'user') {
    return typeof active.id === 'string';
  }
  if (active.kind === 'scratch') {
    return true;
  }
  return false;
}

function isSettingsExportPersistedState(value: unknown): value is SettingsExportPersistedState {
  if (!value || typeof value !== 'object' || hasAuthFields(value)) {
    return false;
  }
  const settings = value as Record<string, unknown>;
  return (
    typeof settings.exportPath === 'string' &&
    (settings.exportStrategy === 'copyWithNumberPrefix' ||
      settings.exportStrategy === 'aimpPlaylist') &&
    typeof settings.lastOpenedPlaylist === 'string' &&
    typeof settings.fileBrowserPath === 'string' &&
    isTrackItemSizePreset(settings.trackItemSizePreset) &&
    typeof settings.hourDividerInterval === 'number' &&
    typeof settings.showHourDividers === 'boolean' &&
    (settings.playerAudioDeviceId === null || typeof settings.playerAudioDeviceId === 'string') &&
    (settings.demoPlayerAudioDeviceId === null ||
      typeof settings.demoPlayerAudioDeviceId === 'string') &&
    typeof settings.keyBindings === 'object' &&
    settings.keyBindings !== null &&
    typeof settings.enableStreaming === 'boolean' &&
    (settings.streamingSource === 'cherryPlayPlayer' || settings.streamingSource === 'aimp') &&
    (settings.loudnessNormalizationEnabled === undefined ||
      typeof settings.loudnessNormalizationEnabled === 'boolean') &&
    (settings.loudnessTargetLufs === undefined ||
      typeof settings.loudnessTargetLufs === 'number') &&
    (settings.loudnessCompressionEnabled === undefined ||
      typeof settings.loudnessCompressionEnabled === 'boolean') &&
    (settings.loudnessQuietGapRangeLu === undefined ||
      typeof settings.loudnessQuietGapRangeLu === 'number') &&
    (settings.fileBrowserPathsByWorkspaceId === undefined ||
      coerceFileBrowserPathsByWorkspaceId(settings.fileBrowserPathsByWorkspaceId) !== undefined)
  );
}

export function validateSettingsExportBundle(data: unknown): data is SettingsExportBundle {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const bundle = data as Record<string, unknown>;
  if (bundle.schemaVersion !== SETTINGS_EXPORT_SCHEMA_VERSION) {
    return false;
  }
  if (typeof bundle.appVersion !== 'string' || typeof bundle.exportedAt !== 'string') {
    return false;
  }
  if (!isSettingsExportPersistedState(bundle.settings)) {
    return false;
  }

  const workspaces = bundle.workspaces;
  if (!workspaces || typeof workspaces !== 'object') {
    return false;
  }

  const workspacesRecord = workspaces as Record<string, unknown>;
  if (!Array.isArray(workspacesRecord.userWorkspaces)) {
    return false;
  }
  if (!workspacesRecord.userWorkspaces.every(isUserWorkspace)) {
    return false;
  }

  if (
    workspacesRecord.activeWorkspace !== undefined &&
    !isActiveWorkspace(workspacesRecord.activeWorkspace)
  ) {
    return false;
  }

  if (workspacesRecord.builtinLayoutOverrides !== undefined) {
    const overrides = workspacesRecord.builtinLayoutOverrides;
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
      return false;
    }
    for (const layout of Object.values(overrides as Record<string, unknown>)) {
      if (!layout || typeof layout !== 'object') {
        return false;
      }
    }
  }

  return !hasAuthFields(bundle);
}

export function parseSettingsBundleJson(text: string): SettingsExportBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Некорректный JSON');
  }

  if (!validateSettingsExportBundle(parsed)) {
    throw new Error('Неподдерживаемый формат файла настроек');
  }

  return parsed;
}

function resolveUniqueWorkspaceName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) {
    return name;
  }

  let suffix = 2;
  while (usedNames.has(`${name} (${suffix})`)) {
    suffix += 1;
  }
  return `${name} (${suffix})`;
}

export function mergeUserWorkspacesOnImport(
  existing: UserWorkspace[],
  incoming: UserWorkspace[],
): { merged: UserWorkspace[]; importedCount: number; updatedCount: number } {
  const mergedById = new Map(existing.map((workspace) => [workspace.id, workspace]));
  const usedNames = new Set(existing.map((workspace) => workspace.name));
  let importedCount = 0;
  let updatedCount = 0;

  for (const workspace of incoming) {
    const exists = mergedById.has(workspace.id);
    const previous = exists ? mergedById.get(workspace.id) : undefined;

    if (previous) {
      usedNames.delete(previous.name);
    }

    const uniqueName = resolveUniqueWorkspaceName(workspace.name, usedNames);
    usedNames.add(uniqueName);

    const nextWorkspace: UserWorkspace = {
      ...workspace,
      name: uniqueName,
      layout: cloneLayout(workspace.layout),
    };

    mergedById.set(workspace.id, nextWorkspace);

    if (exists) {
      updatedCount += 1;
    } else {
      importedCount += 1;
    }
  }

  return {
    merged: Array.from(mergedById.values()),
    importedCount,
    updatedCount,
  };
}

function isImportableActiveWorkspace(
  activeWorkspace: ActiveWorkspace,
  mergedWorkspaces: UserWorkspace[],
): boolean {
  if (activeWorkspace.kind === 'scratch') {
    return false;
  }
  if (activeWorkspace.kind === 'user') {
    return mergedWorkspaces.some((workspace) => workspace.id === activeWorkspace.id);
  }
  return true;
}

function prepareLayoutStateForSettingsImport(): void {
  const state = useLayoutStore.getState();
  state.autoCommitWorkspaceChanges();
  state.setLayoutEditMode(false);
}

function normalizeImportedSettings(
  settings: SettingsExportPersistedState,
): SettingsExportPersistedState & {
  fileBrowserPathsByWorkspaceId: Record<WorkspaceId, string>;
} {
  const coercedMap = coerceFileBrowserPathsByWorkspaceId(settings.fileBrowserPathsByWorkspaceId);
  const migrated = migrateFileBrowserPathsOnRehydrate({
    fileBrowserPath: settings.fileBrowserPath,
    fileBrowserPathsByWorkspaceId: coercedMap ?? {},
  });

  return {
    ...settings,
    fileBrowserPath: migrated.fileBrowserPath,
    fileBrowserPathsByWorkspaceId: migrated.fileBrowserPathsByWorkspaceId,
    loudnessNormalizationEnabled:
      typeof settings.loudnessNormalizationEnabled === 'boolean'
        ? settings.loudnessNormalizationEnabled
        : true,
    loudnessCompressionEnabled:
      typeof settings.loudnessCompressionEnabled === 'boolean'
        ? settings.loudnessCompressionEnabled
        : false,
    loudnessTargetLufs:
      typeof settings.loudnessTargetLufs === 'number'
        ? clampLoudnessTargetLufs(settings.loudnessTargetLufs)
        : DEFAULT_LOUDNESS_TARGET_LUFS,
    loudnessQuietGapRangeLu:
      typeof settings.loudnessQuietGapRangeLu === 'number'
        ? clampLoudnessQuietGapRangeLu(settings.loudnessQuietGapRangeLu)
        : DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
  };
}

export function applySettingsImport(bundle: SettingsExportBundle): SettingsImportResult {
  const normalizedSettings = normalizeImportedSettings(bundle.settings);
  const settingsFieldCount = Object.keys(normalizedSettings).length;
  useSettingsStore.setState(normalizedSettings);

  prepareLayoutStateForSettingsImport();

  const layoutState = useLayoutStore.getState();
  const { merged, importedCount, updatedCount } = mergeUserWorkspacesOnImport(
    layoutState.userWorkspaces,
    bundle.workspaces.userWorkspaces,
  );

  const incomingOverrides = normalizeBuiltinLayoutOverrides(
    bundle.workspaces.builtinLayoutOverrides,
  );
  const mergedOverrides: BuiltinLayoutOverrides = {
    ...normalizeBuiltinLayoutOverrides(layoutState.builtinLayoutOverrides),
    ...incomingOverrides,
  };

  useLayoutStore.setState({
    userWorkspaces: merged,
    builtinLayoutOverrides: mergedOverrides,
  });

  const activeWorkspace = bundle.workspaces.activeWorkspace;
  if (activeWorkspace && isImportableActiveWorkspace(activeWorkspace, merged)) {
    if (activeWorkspace.kind === 'builtin') {
      useLayoutStore.getState().activateWorkspace({
        kind: 'builtin',
        preset: activeWorkspace.preset,
      });
    } else if (activeWorkspace.kind === 'user') {
      useLayoutStore.getState().activateWorkspace({
        kind: 'user',
        id: activeWorkspace.id,
      });
    }
  } else {
    const current = useLayoutStore.getState().activeWorkspace;
    if (current.kind === 'builtin') {
      useLayoutStore.getState().activateWorkspace({
        kind: 'builtin',
        preset: current.preset,
      });
    }
  }

  return {
    settingsFieldCount,
    workspacesImported: importedCount,
    workspacesUpdated: updatedCount,
  };
}

export function downloadSettingsBundleInBrowser(): void {
  const bundle = buildSettingsExportBundle();
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = SETTINGS_EXPORT_BUNDLE_FILENAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function exportSettingsBundleViaNativeDialog(): Promise<boolean> {
  const bundle = buildSettingsExportBundle();
  const path = await ipcService.showSaveDialog({
    title: 'Экспорт настроек',
    defaultPath: SETTINGS_EXPORT_BUNDLE_FILENAME,
    filters: JSON_FILE_FILTERS,
  });

  if (!path) {
    return false;
  }

  await ipcService.invoke('settings:saveBundle', { path, bundle }, false);
  return true;
}

export async function loadSettingsBundleViaNativeDialog(): Promise<SettingsExportBundle | null> {
  const path = await ipcService.showOpenFileDialog({
    title: 'Импорт настроек',
    filters: JSON_FILE_FILTERS,
  });

  if (!path) {
    return null;
  }

  const data = await ipcService.invoke<unknown>('settings:loadBundle', { path }, false);
  if (!validateSettingsExportBundle(data)) {
    throw new Error('Неподдерживаемый формат файла настроек');
  }

  return data;
}

export type SettingsExportOutcome = 'exported' | 'cancelled';

export async function exportSettingsBundle(): Promise<SettingsExportOutcome> {
  if (getPlatformCapabilities().supportsNativeFileSystem) {
    const exported = await exportSettingsBundleViaNativeDialog();
    return exported ? 'exported' : 'cancelled';
  }

  downloadSettingsBundleInBrowser();
  return 'exported';
}
