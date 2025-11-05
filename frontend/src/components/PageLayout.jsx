import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import GlobalBanner from './GlobalBanner';

function PageLayout({ setOpenNotif, unreadCount, onOpenRequestMonitor }) {
  return (
    <div style={{ "--sidebar-width": "220px" }}>
      <GlobalBanner
        setOpenNotif={setOpenNotif}
        unreadCount={unreadCount}
        onOpenRequestMonitor={onOpenRequestMonitor}
      />

      <div className='flex bg-neutral-100 h-[100dvh] min-h-0 w-full'>
        <NavBar
          setOpenNotif={setOpenNotif}
          unreadCount={unreadCount}
          onOpenRequestMonitor={onOpenRequestMonitor} 
        />
        <main className='flex-1 min-h-0 overflow-y-auto lg:ml-[var(--sidebar-width)] pt-2 lg:pt-0 pb-[env(safe-area-inset-bottom)]'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default PageLayout;
