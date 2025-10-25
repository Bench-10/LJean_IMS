import {React, useState} from 'react';
import { MdOutlineInventory, MdOutlineLogout, MdOutlineDashboard, MdMenu, MdClose } from "react-icons/md";
import { IoMdNotifications } from "react-icons/io";
import { PiSealWarningBold } from "react-icons/pi";
import { FaUsersCog, FaMoneyBillWave, FaShippingFast, FaClipboardCheck} from "react-icons/fa";
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../authentication/Authentication';
import LogoutDialog from './dialogs/LogoutDialog';

// Import BranchLogo component
import BranchLogo from './BranchLogo';


function NavBar({ setOpenNotif, unreadCount }) {
  const {user, logout} = useAuth();

  // Separate state for mobile menu and logout dialog
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const toggleMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };
  const location = useLocation();

  const currentLocaion = location.pathname === '/branches' || location.pathname.startsWith('/branch-analytics');

  return (
    <>
        {/* Mobile Header */}
       <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-navBackground p-4 flex items-center justify-between">
         {/* Logo Section */}
         <div className="flex items-center gap-3">
           <div className="h-10">
             <BranchLogo 
               branchName={user?.branch_name || 'L-Jean Trading'}
               className="h-full w-auto" 
             />
           </div>
         </div>
         
         {/* Right side - Notification and Hamburger */}
         <div className="flex items-center gap-2">
          {/* Notification Icon - Only show for Inventory Staff and Branch Manager */}
          {user && (Array.isArray(user.role) ? user.role.some(role => ['Inventory Staff', 'Branch Manager'].includes(role)) : ['Inventory Staff', 'Branch Manager'].includes(user.role)) && (
            <div 
              className={`relative p-2 border-2 rounded-lg transition-all cursor-pointer border-white text-white hover:text-green-400 hover:border-green-400 hover:bg-green-400 hover:bg-opacity-10`} 
              onClick={() => setOpenNotif(true)}
              title="Notifications"
            >
              <IoMdNotifications size={18} />
              {unreadCount > 0 && (
                <div className='absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium text-[10px]'>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </div>
          )}
          
          {/* Hamburger Menu Button */}
          <button 
            onClick={toggleMenu}
            className="text-white p-2"
          >
            {showMobileMenu ? <MdClose size={24} /> : <MdMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={toggleMenu} />
      )}

      {/* Navigation Menu */}
      <nav className={`fixed top-0 left-0 h-screen w-[var(--sidebar-width)] bg-navBackground text-white p-3 box-border transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        showMobileMenu ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 z-50`}> 
        {/*LOGO - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:block">
          <div className="flex justify-center">
            <BranchLogo 
              branchName={user?.branch_name || 'L-Jean Trading'}
              className="h-16 w-auto" 
            />
          </div>
        </div>
        
        {/* Mobile Greeting Section */}
        <div className="lg:hidden mb-4">
          <h2 className='text-white text-lg font-semibold mb-2'>
            {getCurrentGreeting()}, {user?.full_name}!
          </h2>
          <p className='text-gray-300 text-sm'>
            {user?.role} • {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        <hr className="mt-4 mb-4 border-1 border-white" />

        {/*SELECTED ROWS CONTAINER*/}
        <div className="flex flex-col h-[calc(100vh-150px)]">
          {/*TOP HALF - Navigation Links */}
          <div className="flex-1">
              <ul className="flex flex-col gap-2 [&>a]:py-2 [&>a]:px-3 [&>a]:rounded-md [&>a]:transition-all [&>a]:border-l-4-transparent [&>a]:cursor-pointer [&>a:hover]:bg-[#254717] [&>a]:flex [&>a]:items-center [&>a]:gap-x-[7px]">

                {/*INVENTORY NAVIGATION*/}
                {user && (user.role.some(role => ['Branch Manager', 'Owner','Inventory Staff'].includes(role))) &&
                    <NavLink
                      to="/inventory"
                      className={({ isActive }) =>
                        isActive
                          ? "border-l-8 bg-[#254717] border-l-green-400"
                          : ""
                      }
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <MdOutlineInventory />Inventory
                    </NavLink>
                }

                {/*PRODUCT VALIDITY NAVIGATION*/}
                {user && (user.role.some(role => ['Branch Manager', 'Inventory Staff'].includes(role))) &&
                    <NavLink
                      to="/product_validity"
                      className={({ isActive }) =>
                        isActive
                          ? "border-l-8 bg-[#254717] border-l-green-400"
                          : ""
                      }
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <PiSealWarningBold />Product Validity
                    </NavLink>
                }

                {/*DASHBOARD NAVIGATION*/}
                {user && (user.role.some(role => ['Branch Manager', 'Owner'].includes(role))) &&
                    <NavLink
                      to="/dashboard"
                      className={({ isActive }) =>
                        (isActive || currentLocaion)
                          ? "border-l-8 bg-[#254717] border-l-green-400"
                          : ""
                      }
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <MdOutlineDashboard />Dashboard
                    </NavLink>
                }

                {/*USER MANAGEMENT NAVIGATION*/}
                {user && (user.role.some(role => ['Branch Manager','Owner'].includes(role))) &&
                    <NavLink
                      to="/user_management"
                      className={({ isActive }) =>
                        isActive
                          ? "border-l-8 bg-[#254717] border-l-green-400"
                          : ""
                      }
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <FaUsersCog />User Management
                    </NavLink>
                }

                {/*SALES NAVIGATION*/}
                {user && (user.role.some(role => ['Sales Associate'].includes(role))) &&
                    <NavLink
                      to="/sales"
                      className={({ isActive }) =>
                        isActive
                          ? "border-l-8 bg-[#254717] border-l-green-400"
                          : ""
                      }
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <FaMoneyBillWave />Sales Transactions
                    </NavLink>
                }

                {/*DELIVERY MONITORING NAVIGATION*/}
                {user && (user.role.some(role => ['Sales Associate'].includes(role))) &&
                    <NavLink
                      to="/delivery"
                      className={({ isActive }) =>
                        isActive
                          ? "border-l-8 bg-[#254717] border-l-green-400"
                          : ""
                      }
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <FaShippingFast />Deliveries
                    </NavLink>
                }
              
                {/*APPROVAL CENTER NAVIGATION*/}
                {user && user.role && (user.role.some(role => ['Owner'].includes(role))) &&

                  <NavLink
                    to="/approvals"
                    className={({ isActive }) =>
                      isActive
                        ? "border-l-8 bg-[#254717] border-l-green-400"
                        : ""
                    }
                  >
                    <FaClipboardCheck />Approvals
                  </NavLink>

              }
              </ul>
          </div>

          {/*BOTTOM HALF - Logout Button */}
          <div className='mb-3 lg:mb-0'>
            <button  
                className='w-full bg-green-600 py-2 px-2 rounded-md flex items-center justify-center gap-2 hover:bg-green-700 transition-colors'
                onClick={() => {
                  setShowLogoutDialog(true);
                  setShowMobileMenu(false); // Close mobile menu when logout dialog opens
                }}
              >
                <MdOutlineLogout /> Logout
              </button>
          </div>
        </div>

        {/* Logout Dialog */}
        {showLogoutDialog && (
          <LogoutDialog 
            onClose={() => setShowLogoutDialog(false)} 
            logout={async () => {
              try {
                setIsLoggingOut(true);
                await logout();
                setShowLogoutDialog(false);
              } catch (e) {
                console.error('Logout failed', e);
              } finally {
                setIsLoggingOut(false);
              }
            }}
            loading={isLoggingOut}
          />
        )}
      </nav>
    </>
  )
}

export default NavBar
