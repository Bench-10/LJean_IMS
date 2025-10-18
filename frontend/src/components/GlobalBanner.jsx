import React from 'react'
import { useAuth } from '../authentication/Authentication';
import { IoMdNotifications } from "react-icons/io";

function GlobalBanner({setOpenNotif, unreadCount}) {

  const {user} = useAuth();
  
  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className='hidden lg:block lg:ml-[var(--sidebar-width)] pt-12 sm:pt-4 pb-4 px-8 bg-white/95 backdrop-blur-sm '>
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


                {(user && user.role && user.role.some(role => ['Inventory Staff', 'Branch Manager', 'Owner'].includes(role))) &&
                    <div className='relative p-2 border-2 rounded-lg border-gray-600 hover:text-white hover:bg-gray-600 transition-all cursor-pointer' onClick={setOpenNotif}>
                        <IoMdNotifications />
                        {unreadCount > 0 && (
                            <div className='absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium'>
                            {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                        )}
                        
                    </div>
               
               }

        </div>
        
    </div>
  )
}

export default GlobalBanner
