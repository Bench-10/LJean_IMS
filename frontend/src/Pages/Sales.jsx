import React from 'react';
import { useAuth } from '../authentication/Authentication';

function Sales({setIsModalOpen}) {

  const {user} = useAuth();

  return (
    <div className=' ml-[220px] p-8 max-h-screen'>


        <h1 className=' text-4xl font-bold text-green-900'>
          SALES TRANSACTIONS
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>


        {/*SEARCH AND ADD*/}
        <div className='flex w-full'>
          {/*SEARCH */}
          <div className='w-[400px]'>
            
            <input
              type="text"
              placeholder="Search Item Name or Category"
              className="border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9"
              
            />

          </div>


          {/*APEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
          {user.role === 'Sales Associate' &&
          
            <div  className="ml-auto flex gap-4">


              {/*ADD SALE BTN*/}
              <button className='border border-[#63FF4F] text-[#63FF4F] font-medium hover:bg-[#63FF4F] hover:text-white px-5 rounded-md transition-all'  onClick={() => setIsModalOpen(true)}> ADD SALE</button>

            </div>

          }
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>
        
    </div>
  )
}

export default Sales