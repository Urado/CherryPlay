import React from 'react';

import { APP_VERSION } from '@shared/config';

export const AppFooter: React.FC = () => {
  return (
    <div className="app-footer">
      <span className="app-footer-version">v{APP_VERSION}</span>
    </div>
  );
};
