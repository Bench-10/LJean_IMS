import React from 'react'

function ProductValidity() {
  
  return (
    <div className=" ml-[220px] p-8 max-h-screen" >
        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          PRODUCT VALIDITY
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

          {/*EXPIRY LABEL*/}
          <div  className="ml-auto flex gap-4 mr-14">
            
            {/*NEAR EXPIRY DIV*/}
            <div className='flex gap-4 align-middle'>
              <span className="relative pl-6 content-center before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-4 before:h-4 before:rounded before:bg-[#FFF3C1]">
                Near Expiry
              </span>
            </div>


            {/*EXPIRED DIV*/}
           <div className='flex gap-4'>
              <span className="relative pl-6 content-center before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-4 before:h-4 before:rounded before:bg-[#FF3131]">
                Expired
              </span>
            </div>

          </div>
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        

    </div>

  )
}

export default ProductValidity