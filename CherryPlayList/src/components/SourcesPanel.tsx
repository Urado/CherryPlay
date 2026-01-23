import React from 'react';

import { useUIStore } from '@shared/stores';

import { FileBrowser } from './FileBrowser';

export const SourcesPanel: React.FC = () => {
  const { activeSource } = useUIStore();

  return (
    <div className="sources-panel">
      {activeSource === 'fileBrowser' && <FileBrowser />}
      {activeSource === 'playlists' && (
        <div className="empty-state">
          <p>Плейлисты (в разработке)</p>
        </div>
      )}
      {activeSource === 'db' && (
        <div className="empty-state">
          <p>База данных (в разработке)</p>
        </div>
      )}
    </div>
  );
};
