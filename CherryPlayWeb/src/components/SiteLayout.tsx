import { Outlet } from 'react-router-dom';

import { SiteAuthProvider } from '../contexts/SiteAuthContext';

import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import './SiteLayout.css';

export const SiteLayout = () => (
  <SiteAuthProvider>
    <div className="site-layout" data-shell-theme="dark">
      <SiteHeader />
      <div className="site-layout-content"><Outlet /></div>
      <SiteFooter />
    </div>
  </SiteAuthProvider>
);
