import React from 'react';

import { DemoPlayer } from '@shared/components';
import { useUIStore } from '@shared/stores';

const DemoPlayerWorkspaceView: React.FC = () => {
  const focusFileInBrowser = useUIStore((state) => state.focusFileInBrowser);

  return (
    <div className="demo-player-workspace">
      <div className="demo-player-workspace__body">
        <div className="demo-player-workspace__player">
          <DemoPlayer onShowInBrowser={focusFileInBrowser} clearOnUnmount={false} />
        </div>
      </div>
    </div>
  );
};

export default DemoPlayerWorkspaceView;
