import React from 'react';

import { isDemoLiveMode } from '@shared/platform';

export const DemoModeBanner: React.FC = () => {
  const live = isDemoLiveMode();
  return (
    <div className="demo-mode-banner" role="status">
      {live
        ? 'Режим веб-демо (live) — без Electron, связь с сервером через Vite proxy'
        : 'Режим веб-демо — без Electron и без связи с сервером'}
    </div>
  );
};
