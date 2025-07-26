import React from 'react';
import { IoIosConstruct } from "react-icons/io";

function Dashboard() {
  return (
    <div className='ml-[220px] flex justify-center items-center h-screen'>
    
        <div className='flex flex-col justify-center items-center text-gray-500'>
            <IoIosConstruct className='size-24 mb-3'/>
            <h1 className='font-bold text-3xl mb-3'>Page in construction.</h1>
            <p>This page is for manager and owner only.</p>
            
        </div>
        
    </div>

  )
}

export default Dashboard