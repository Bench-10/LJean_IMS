import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import GlobalBanner from './GlobalBanner';


function PageLayout({setOpenNotif, unreadCount}) {
  return (
    <div style={{"--sidebar-width": "220px"}}>
      <GlobalBanner setOpenNotif={setOpenNotif} unreadCount={unreadCount}/>
        <div className='flex bg-neutral-100 min-h-screen w-full'>
        <NavBar setOpenNotif={setOpenNotif} unreadCount={unreadCount} />
      <main className='flex-1 overflow-y-auto lg:ml-[var(--sidebar-width)] pt-2 lg:pt-0'>
          <Outlet />
      </main>
    </div>
    </div>
  )
}

export default PageLayout
