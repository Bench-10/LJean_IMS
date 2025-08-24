import React from 'react';
import { NavLink } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

function BranchAnalyticsCards() {
  return (
    <div className='ml-[220px] px-6 py-3 h-full overflow-hidden bg-[#eef2ee] flex flex-col'>

        <div className="flex flex-wrap items-center" >
            <NavLink to="/dashboard" className={` flex  gap-x-2 items-center relative py-1 px-2 border-2 rounded-md border-gray-600 transition-all cursor-pointer hover:text-white hover:bg-gray-600`} >
                <IoArrowBack />
                <span className="text-sm">
                    Go back
                </span>
            </NavLink>
        </div>

        {/* BRANCH CARD CONTAINER */}
        <div className='grid grid-cols-1 gap-12 mt-5 px-12 sm:grid-cols-2 lg:grid-cols-3 gap-4"'>
            {/*BRANCH CARD*/}
            <div className='bg-white p-5 border-2 border-green-600 rounded-md '>
                {/*BRANCH IMAGE */}
                <div className='h-32 bg-gray-300 rounded-sm'>
                  try
                </div>

                {/*BRANCH INFORMATION */}
                <div className='flex flex-col gap-y-7 text-center mt-5'>
                    {/*BRANCH TITLE */}
                    <div>
                        <h1 className='text-green-700 text-md font-bold'>LJEAN TRADING</h1>
                    </div>

                     {/*BRANCH ADDRESS */}
                    <div>
                        <h3 className='text-sm'>dasdasdasd</h3>
                    </div>

                      {/*vIEW ANALYTICS BUTTON */}
                    <div>
                        <button className='border-2 border-green-700 bg-green-100 py-2 px-5 rounded-md text-sm text-green-800 font-semibold'>View Analytics</button>
                    </div>

                </div>
            </div>

            


             
        </div>
        
    </div>
  )
}

export default BranchAnalyticsCards