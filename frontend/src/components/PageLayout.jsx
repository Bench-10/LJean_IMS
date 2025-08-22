import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import GlobalBanner from './GlobalBanner';


function PageLayout({setOpenNotif, unreadCount}) {
  return (
    <div className='flex flex-col h-screen overflow-hidden'>
      <GlobalBanner setOpenNotif={setOpenNotif} unreadCount={unreadCount}/>
      <NavBar/>
      <main className='flex-1 overflow-hidden min-h-0'>
        <Outlet />
      </main>
    </div>
  )
}

export default PageLayout