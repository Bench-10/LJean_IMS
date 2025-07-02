import React from 'react'

function Notification() {
  return (
    <div className=' ml-[220px] p-8 max-h-screen'>

      <div className='mb-7'>
         <h1 className='text-4xl font-bold mb-2'>
            Notification
         </h1>

         <h2 className='text-md font-semibold'>Welcome Bench Christian</h2>
      </div>
 
      {/*NOTIFICATION CONTAINER*/} 
      <div className='flex flex-col gap-y-8'>

        {/*TODAY NOTIFICATION*/}
        <div className=''>

          <div className='flex items-center'>
            <h1 className='font-bold mr-2'>
              Today
            </h1>

            <hr  className='w-[100%] border-1 border-gray-400'/>

          </div>
          

          {/*TODAYS NOTIFICATION BLOCK CONTAINER*/}
          <div className='mt-3 flex flex-col gap-y-4'>

             {/*TNOTIFICATION BLOCK */}
            <div className='bg-white relative flex flex-col px-8 py-4 border-2 border-gray-200 border-l-4 border-l-red-800 rounded-lg shadow-lg'>

              <div className='mb-2'>
                <h1 className='text-xl font-bold'>LOW STOCK</h1>
              </div>

              <div className='mb-5'>
                <span className=''>
                  Product 1 has reached the minimun quantity of 200!
                </span>
              </div>

              <div className='absolute right-8 bottom-2'>
                <span className='text-xs italic'>
                  5 mins ago
                </span>
              </div>

            </div>


            
             {/*TNOTIFICATION BLOCK */}
            <div className='bg-white relative flex flex-col px-8 py-4 border-2 border-gray-200 border-l-4 border-l-red-800 rounded-lg shadow-lg'>

              <div className='mb-2'>
                <h1 className='text-xl font-bold'>LOW STOCK</h1>
              </div>

              <div className='mb-5'>
                <span className=''>
                  Product 1 has reached the minimun quantity of 200!
                </span>
              </div>

              <div className='absolute right-8 bottom-2'>
                <span className='text-xs italic'>
                  5 mins ago
                </span>
              </div>

            </div>


          </div>
        </div>

        {/*PREVIOUS NOTIFICATION*/}
        <div className=''>
          <div className='flex items-center'>
            <h1 className='font-bold mr-2'>
              Previous
            </h1>
            
            <hr  className='w-[100%] border-1 border-gray-400'/>

          </div>

          {/*PREVIOUS NOTIFICATION BLOCK CONTAINER */}
          <div className='mt-3 flex flex-col gap-y-4'>

             {/*TNOTIFICATION BLOCK */}
            <div className='bg-white relative flex flex-col px-8 py-4 border-2 border-gray-200 border-l-4 border-l-red-800 rounded-lg shadow-lg'>

              <div className='mb-2'>
                <h1 className='text-xl font-bold'>LOW STOCK</h1>
              </div>

              <div className='mb-5'>
                <span className=''>
                  Product 1 has reached the minimun quantity of 200!
                </span>
              </div>

              <div className='absolute right-8 bottom-2'>
                <span className='text-xs italic'>
                  5 mins ago
                </span>
              </div>

            </div>


            
             {/*TNOTIFICATION BLOCK */}
            <div className='bg-white relative flex flex-col px-8 py-4 border-2 border-gray-200 border-l-4 border-l-red-800 rounded-lg shadow-lg'>

              <div className='mb-2'>
                <h1 className='text-xl font-bold'>LOW STOCK</h1>
              </div>

              <div className='mb-5'>
                <span className=''>
                  Product 1 has reached the minimun quantity of 200!
                </span>
              </div>

              <div className='absolute right-8 bottom-2'>
                <span className='text-xs italic'>
                  5 mins ago
                </span>
              </div>

            </div>


          </div>
        </div>

      </div>
      
    </div>
  )
}

export default Notification