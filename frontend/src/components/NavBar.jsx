import React, { useState } from 'react';
import { MdOutlineInventory, MdOutlineLogout, MdOutlineDashboard, MdMenu, MdClose, MdPendingActions } from "react-icons/md";
import { IoMdNotifications } from "react-icons/io";
import { PiSealWarningBold } from "react-icons/pi";
import { FaUsersCog, FaMoneyBillWave, FaShippingFast, FaClipboardCheck } from "react-icons/fa";
import { NavLink } from 'react-router-dom';
import { useAuth } from '../authentication/Authentication';
import LogoutDialog from './dialogs/LogoutDialog';
import BranchLogo from './BranchLogo';

function NavBar({ setOpenNotif = () => {}, unreadCount = 0, onOpenRequestMonitor }) {
  const { user, logout } = useAuth();

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const toggleMenu = () => setShowMobileMenu(v => !v);

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Derive current path without useLocation() to avoid Router-context crashes
  const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
  const inBranchArea = pathname === '/branches' || pathname.startsWith('/branch-analytics');

  // ---- Safe roles helper ----
  const roles = Array.isArray(user?.role) ? user.role : (user?.role ? [user.role] : []);
  const canSeeRequestStatus = roles.some(r => ['Inventory Staff', 'Branch Manager'].includes(r));
  const canSeeNotifications = roles.some(r =>
  ['Inventory Staff', 'Sales Associate', 'Branch Manager', 'Owner'].includes(r)
);

  const handleRequestClick = () => {
    if (typeof onOpenRequestMonitor === 'function') onOpenRequestMonitor();
  };

  return (
    <>
      {/* Header for mobile + tablet (desktop hidden) */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-50 bg-navBackground p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10">
            <BranchLogo branchName={user?.branch_name || 'L-Jean Trading'} className="h-full w-auto" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canSeeRequestStatus && (
            <button
              type="button"
              className="relative p-2 border-2 rounded-lg transition-all cursor-pointer border-white text-white hover:text-green-400 hover:border-green-400 hover:bg-green-400 hover:bg-opacity-10"
              onClick={handleRequestClick}
              title="Request Status"
              aria-label="Open Request Status"
            >
              <MdPendingActions size={18} />
            </button>
          )}

          {canSeeNotifications && (
            <button
              type="button"
              className="relative p-2 border-2 rounded-lg transition-all cursor-pointer border-white text-white hover:text-green-400 hover:border-green-400 hover:bg-green-400 hover:bg-opacity-10"
              onClick={() => setOpenNotif(true)}
              title="Notifications"
              aria-label="Open notifications"
            >
              <IoMdNotifications size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium text-[10px]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          <button onClick={toggleMenu} className="text-white p-2" aria-label="Toggle menu">
            {showMobileMenu ? <MdClose size={24} /> : <MdMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Menu overlay for mobile + tablet */}
      {showMobileMenu && (
        <div className="xl:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={toggleMenu} />
      )}

      {/* Sidebar */}
      <nav
  role="navigation"
  aria-label="Sidebar"
  className={`fixed top-0 left-0 w-[var(--sidebar-width)] bg-navBackground text-white p-3 box-border
  transition-transform duration-300 ease-in-out flex flex-col min-h-0
  ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0 z-50`}
  style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}
>

        {/* Desktop logo (>= xl) */}
        <div className="hidden xl:block flex-shrink-0">
          <div className="flex justify-center pt-2">
            <BranchLogo branchName={user?.branch_name || 'L-Jean Trading'} className="h-16 w-auto" />
          </div>
        </div>

        <div className="xl:hidden h-5 shrink-0" aria-hidden="true" />

        {/* Greeting (mobile/tablet) */}
        <div className="xl:hidden mb-4 flex-shrink-0">
          <h2 className="text-white text-lg font-semibold mb-2">
            {getCurrentGreeting()}, {user?.full_name}!
          </h2>
          <p className="text-gray-300 text-sm">
            {roles.join(' / ') || 'User'} • {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>

        <hr className="mt-4 mb-4 border-1 border-white flex-shrink-0" />

        {/* Links */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-24">
          <ul className="flex flex-col gap-2 [&>a]:py-2 [&>a]:px-3 [&>a]:rounded-md [&>a]:transition-all [&>a]:border-l-4-transparent [&>a]:cursor-pointer [&>a:hover]:bg-[#254717] [&>a]:flex [&>a]:items-center [&>a]:gap-x-[7px]">

            {roles.some(r => ['Branch Manager','Owner','Inventory Staff'].includes(r)) && (
              <NavLink to="/inventory" className={({ isActive }) => (isActive ? "border-l-8 bg-[#254717] border-l-green-400" : "")} onClick={() => setShowMobileMenu(false)}>
                <MdOutlineInventory />Inventory
              </NavLink>
            )}

            {roles.some(r => ['Branch Manager','Inventory Staff'].includes(r)) && (
              <NavLink to="/product_validity" className={({ isActive }) => (isActive ? "border-l-8 bg-[#254717] border-l-green-400" : "")} onClick={() => setShowMobileMenu(false)}>
                <PiSealWarningBold />Product Validity
              </NavLink>
            )}

            {roles.some(r => ['Branch Manager','Owner'].includes(r)) && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) => ((isActive || inBranchArea) ? "border-l-8 bg-[#254717] border-l-green-400" : "")}
                onClick={() => setShowMobileMenu(false)}
              >
                <MdOutlineDashboard />Dashboard
              </NavLink>
            )}

            {roles.some(r => ['Branch Manager','Owner'].includes(r)) && (
              <NavLink to="/user_management" className={({ isActive }) => (isActive ? "border-l-8 bg-[#254717] border-l-green-400" : "")} onClick={() => setShowMobileMenu(false)}>
                <FaUsersCog />User Management
              </NavLink>
            )}

            {roles.some(r => ['Sales Associate'].includes(r)) && (
              <NavLink to="/sales" className={({ isActive }) => (isActive ? "border-l-8 bg-[#254717] border-l-green-400" : "")} onClick={() => setShowMobileMenu(false)}>
                <FaMoneyBillWave />Sales Transactions
              </NavLink>
            )}

            {roles.some(r => ['Sales Associate'].includes(r)) && (
              <NavLink to="/delivery" className={({ isActive }) => (isActive ? "border-l-8 bg-[#254717] border-l-green-400" : "")} onClick={() => setShowMobileMenu(false)}>
                <FaShippingFast />Deliveries
              </NavLink>
            )}

            {roles.some(r => ['Owner'].includes(r)) && (
              <NavLink to="/approvals" className={({ isActive }) => (isActive ? "border-l-8 bg-[#254717] border-l-green-400" : "")} onClick={() => setShowMobileMenu(false)}>
                <FaClipboardCheck />Approvals
              </NavLink>
            )}
          </ul>
        </div>

        {/* Logout Button - Sticky bottom (always visible) */}
<div className="sticky bottom-0 left-0 right-0 bg-navBackground/95 backdrop-blur pt-2
                pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
  <button
    className="w-full text-[13px] bg-green-600 py-2 px-2 rounded-md flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
    onClick={() => {
      setShowLogoutDialog(true);
      setShowMobileMenu(false);
    }}
  >
    <MdOutlineLogout /> Logout
  </button>
</div>


        {showLogoutDialog && (
          <LogoutDialog
            onClose={() => setShowLogoutDialog(false)}
            logout={async () => {
              try { setIsLoggingOut(true); await logout(); setShowLogoutDialog(false); }
              catch (e) { console.error('Logout failed', e); }
              finally { setIsLoggingOut(false); }
            }}
            loading={isLoggingOut}
          />
        )}
      </nav>
    </>
  );
}

export default NavBar;
