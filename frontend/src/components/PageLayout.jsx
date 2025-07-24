import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';


function PageLayout() {
  return (
    <>
        <NavBar/>
        <main>
            <Outlet /> 
        </main>
    </>
  )
}

export default PageLayout