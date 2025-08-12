import React from 'react';
import { MdOutlineInventory, MdOutlineLogout, MdOutlineDashboard } from "react-icons/md";
import { PiSealWarningBold } from "react-icons/pi";
import { FaUsersCog, FaMoneyBillWave, FaShippingFast} from "react-icons/fa";
import { NavLink } from 'react-router-dom';
import { useAuth } from '../authentication/Authentication';


function NavBar() {
  const {user, logout} = useAuth();

  return (
    <nav className="fixed top-0 left-0 h-screen w-[220px] bg-navBackground text-white p-3 box-border"> 
      {/*LOGO*/}
      <div>
         LOGO HERE
      </div>

      <hr className="mt-5 mb-6 border-1 border-white" />

      {/*SELECTED ROWS CONTAINER*/}
      <div className="flex flex-col justify-between h-[90%]">
        {/*TOP HALF */}
        <div>
            <ul className="flex flex-col gap-2 [&>a]:py-2 [&>a]:px-3 [&>a]:rounded-md [&>a]:transition-all [&>a]:border-l-4-transparent [&>a]:cursor-pointer [&>a:hover]:bg-[#254717] [&>a]:flex [&>a]:items-center [&>a]:gap-x-[7px]">



              {/*INVENTORY NAVIGATION*/}
              {user && (user.role === 'Branch Manager' || user.role === 'Owner' || user.role === 'Inventory Staff') &&

                  <NavLink
                    to="/inventory"
                    className={({ isActive }) =>
                      isActive
                        ? "border-l-8 bg-[#254717] border-l-green-400"
                        : ""
                    }
                  >
                    <MdOutlineInventory />Inventory
                  </NavLink>

              }



              {/*PRODUCT VALIDITY NAVIGATION*/}
              {user && (user.role === 'Branch Manager' || user.role === 'Inventory Staff') &&

                  <NavLink
                    to="/product_validity"
                    className={({ isActive }) =>
                      isActive
                        ? "border-l-8 bg-[#254717] border-l-green-400"
                        : ""
                    }
                  >
                    <PiSealWarningBold />Product Validity
                  </NavLink>

              }


              {/*DASHBOARD NAVIGATION*/}
              {user && (user.role === 'Branch Manager' || user.role === 'Owner') &&

                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      isActive
                        ? "border-l-8 bg-[#254717] border-l-green-400"
                        : ""
                    }
                  >
                    <MdOutlineDashboard />Dasboard
                  </NavLink>

              }


              {/*USER MANAGEMENT NAVIGATION*/}
              {user && (user.role === 'Owner') &&

                  <NavLink
                    to="/user_management"
                    className={({ isActive }) =>
                      isActive
                        ? "border-l-8 bg-[#254717] border-l-green-400"
                        : ""
                    }
                  >
                    <FaUsersCog />User Management
                  </NavLink>

              }


              {/*SALES NAVIGATION*/}
              {user && (user.role === 'Sales Associate') &&

                  <NavLink
                    to="/sales"
                    className={({ isActive }) =>
                      isActive
                        ? "border-l-8 bg-[#254717] border-l-green-400"
                        : ""
                    }
                  >
                    <FaMoneyBillWave />Sales Transactions
                  </NavLink>

              }


              {/*DELIVERY MONITORING NAVIGATION*/}
              {user && (user.role === 'Sales Associate') &&

                  <NavLink
                    to="/delivery"
                    className={({ isActive }) =>
                      isActive
                        ? "border-l-8 bg-[#254717] border-l-green-400"
                        : ""
                    }
                  >
                    <FaShippingFast />Deliveries
                  </NavLink>

              }
              

            </ul>
        </div>

        {/*SECOND HALF*/}
        <div className='flex justify-center'>
          <button  
            className='bg-green-600 py-2 px-9 rounded-md flex items-center justify-center gap-2'
            onClick={() => logout()}
          >
            <MdOutlineLogout /> Logout
          </button>
        </div>
      </div>
    </nav>
  )
}

export default NavBar