import React from 'react';
import { IoMdNotifications } from "react-icons/io";
import { MdOutlineInventory } from "react-icons/md";
import { PiSealWarningBold } from "react-icons/pi";
import { NavLink } from 'react-router-dom';


function NavBar() {
  return (
    <nav className=" fixed top-0 left-0 h-screen w-[220px] bg-navBackground text-white p-3"> 
      {/*LOGO*/}
      <div>
         LOGO HERE
      </div>

      <hr className="mt-5 mb-6 border-1 border-white" />
     
      <div className=''>
        <ul className="flex flex-col gap-2 [&>a]:py-2 [&>a]:px-3 [&>a]:rounded-md [&>a]:transition-all [&>a]:border-l-transparent [&>a]:border-l-4 [&>a]:cursor-pointer [&>a:hover]:bg-[#254717] [&>a:hover]:border-l-emerald-800 [&>a]:flex [&>a]:items-center [&>a]:gap-x-[7px]">
          <NavLink to="/notification"><IoMdNotifications />Notification</NavLink>
          <NavLink to="/"><MdOutlineInventory />Inventory</NavLink>
          <NavLink to="/product_validity"><PiSealWarningBold />Product Validity</NavLink>
        </ul>
      </div>
    </nav>
  )
}

export default NavBar