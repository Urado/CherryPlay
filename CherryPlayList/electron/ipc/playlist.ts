import fs from 'fs/promises';

import { ipcMain } from 'electron';

interface PlaylistData {
  name: string;
  tracks: {
    path: string;
    name: string;
    duration?: number;
  }[];
}

async function savePlaylist(path: string, data: PlaylistData): Promise<void> {
  await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

async function loadPlaylist(path: string): Promise<PlaylistData> {
  const content = await fs.readFile(path, 'utf-8');
  return JSON.parse(content);
}

export function registerPlaylistHandlers(): void {
  ipcMain.handle('playlist:save', async (_event, payload: { path: string; data: PlaylistData }) => {
    await savePlaylist(payload.path, payload.data);
    return { success: true };
  });

  ipcMain.handle('playlist:load', async (_event, payload: { path: string }) => {
    return await loadPlaylist(payload.path);
  });
}
