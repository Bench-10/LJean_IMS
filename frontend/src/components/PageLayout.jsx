import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import GlobalBanner from './GlobalBanner';

function PageLayout({ setOpenNotif, unreadCount, onOpenRequestMonitor }) {
  return (
    <div style={{ "--sidebar-width": "210px" }}>
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
<main className="flex-1 overflow-y-auto xl:ml-[var(--sidebar-width)] xl:pt-0 hide-scrollbar">
  <Outlet />
</main>
      </div>
    </div>
  );
}

export default PageLayout;
