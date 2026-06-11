import { projectService } from '../services/projectService';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
export const DEMO_SAMPLE_PROJECT_URL = '/demo/sample.cherry';

function demoLoadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export const DEMO_SAMPLE_PROJECT_PATH = '/demo/sample.cherry';

/**
 * Fetches the static demo project and loads it into the project store.
 * Used by `VITE_LOAD_DEMO_PROJECT=1` and the demo menu action (subtask 04).
 */
export async function loadDemoProject(): Promise<void> {
  const response = await fetch(DEMO_SAMPLE_PROJECT_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch demo project (${response.status})`);
  }

  const rawData: unknown = await response.json();
  const projectData = await projectService.loadProjectFromData(rawData, DEMO_SAMPLE_PROJECT_PATH);

  useProjectStore.getState().loadProject({
    ...projectData,
    filePath: DEMO_SAMPLE_PROJECT_PATH,
    linkedParty: projectData.linkedParty ?? null,
  });

  useSettingsStore.getState().setLastOpenedPlaylist(DEMO_SAMPLE_PROJECT_PATH);

  useUIStore.getState().addNotification({
    type: 'success',
    message: 'Демо-проект загружен',
  });
}

export async function loadDemoProjectSafe(): Promise<boolean> {
  try {
    await loadDemoProject();
    return true;
  } catch (error) {
    useUIStore.getState().addNotification({
      type: 'error',
      message: `Ошибка загрузки демо-проекта: ${demoLoadErrorMessage(error)}`,
    });
    return false;
  }
}

export function shouldAutoLoadDemoProject(): boolean {
  return import.meta.env.VITE_LOAD_DEMO_PROJECT === '1';
}
