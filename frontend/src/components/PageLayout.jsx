import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import GlobalBanner from './GlobalBanner';


function PageLayout({setOpenNotif, unreadCount}) {
  return (
    <>
        <GlobalBanner setOpenNotif={setOpenNotif} unreadCount={unreadCount}/>
        <NavBar/>
        <main>
            <Outlet /> 
        </main>
    </>
  )
}

export default PageLayout