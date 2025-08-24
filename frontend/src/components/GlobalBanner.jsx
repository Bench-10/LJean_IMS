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
    <div className='ml-[220px] pt-4  pb-2 px-8 bg-white/95 backdrop-blur-sm '>
        {/*GREETINGS BANNER */}
        <div className='flex items-center justify-between'>

            <div className='flex items-center justify-between gap-x-6'>

                <div className='flex flex-col'>

                    <h2 className='text-gray-800 text-lg font-semibold'>
                        {getCurrentGreeting()}, {user?.full_name}!
                    </h2>

                    <p className='text-gray-500 text-sm'>
                        {user?.role} • {new Date().toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 

                        })}

                    </p>

                </div>


               {(user.role === 'Inventory Staff' || user.role === 'Branch Manager') &&
                    <div className='relative p-2 border-2 rounded-md border-gray-600 hover:text-white hover:bg-gray-600 transition-all cursor-pointer' onClick={setOpenNotif}>
                        <IoMdNotifications />
                        {unreadCount > 0 && (
                            <div className='absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium'>
                            {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                        )}
                        
                    </div>
               
               }


                

            </div>

            <div className='flex items-center space-x-4'>
                <div className='hidden md:flex items-center bg-emerald-50 border border-emerald-500 rounded-full px-4 py-2'>
                    <div className='w-2 h-2 bg-emerald-500 rounded-full mr-2'></div>
                    <span className='text-emerald-700 text-sm font-medium'>System Online</span>

                </div>

            </div>

        </div>
        
    </div>
  )
}

export default GlobalBanner