import React, { useMemo, useCallback } from 'react';
import { useAuth } from '../authentication/Authentication';
import { IoMdNotifications } from "react-icons/io";

function GlobalBanner({setOpenNotif, unreadCount, onOpenRequestMonitor}) {

  const {user} = useAuth();
  
  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

    const userRoles = useMemo(() => {
        if (!user) return [];
        if (Array.isArray(user.role)) return user.role;
        return user.role ? [user.role] : [];
    }, [user]);

    const canOpenRequests = userRoles.some(role => ['Inventory Staff', 'Branch Manager'].includes(role));
    const showNotifications = typeof setOpenNotif === 'function';

    const handleNotificationClick = useCallback(() => {
        if (typeof setOpenNotif === 'function') {
            setOpenNotif();
        }
    }, [setOpenNotif]);

    const handleRequestMonitorClick = useCallback(() => {
        if (typeof onOpenRequestMonitor === 'function') {
            onOpenRequestMonitor();
        }
    }, [onOpenRequestMonitor]);

  return (
    <div className='hidden lg:block lg:ml-[var(--sidebar-width)] pt-12 sm:pt-4 pb-2 px-8 bg-white/95 backdrop-blur-sm '>
        {/*GREETINGS BANNER */}
        <div className='flex items-center justify-between'>

            <div className='flex items-center justify-between gap-x-6'>

                <div className='flex flex-col'>

                    <h2 className='text-gray-800 text-lg font-semibold'>
                        {getCurrentGreeting()}, {user?.full_name}!
                    </h2>

                    <p className='text-gray-500 text-sm'>
                        {user.role.length > 1 ? user.role.join(" / ") : user.role} • {new Date().toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 

                        })}

                    </p>

                </div>

            </div>


                                {(canOpenRequests || showNotifications) && (
                                    <div className='flex items-center gap-3'>
                                        {canOpenRequests && (
                                            <button
                                                type="button"
                                                className='h-10 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-600'
                                                onClick={handleRequestMonitorClick}
                                            >
                                                Request History
                                            </button>
                                        )}
								
                                        {showNotifications && (
                                            <button
                                                type="button"
                                                className='relative flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-600 text-gray-700 transition hover:bg-gray-600 hover:text-white'
                                                onClick={handleNotificationClick}
                                                aria-label="Open notifications"
                                            >
                                                <IoMdNotifications />
                                                {unreadCount > 0 && (
                                                    <span className='absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white'>
                                                        {unreadCount > 99 ? '99+' : unreadCount}
                                                    </span>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}

        </div>
        
    </div>
  )
}

export default GlobalBanner
