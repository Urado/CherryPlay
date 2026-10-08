import { APP_VERSION } from '@shared/config';
import React from 'react';


export const AppFooter: React.FC = () => {
  return (
    <div className="app-footer">
      <span className="app-footer-version">v{APP_VERSION}</span>
    </div>
  );
};
