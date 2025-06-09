import React from 'react'

function Category({isCategoryOpen, onClose}) {
  return (
    <div >

        {isCategoryOpen && (
        <div
          className="fixed inset-0 bg-black/35 bg-opacity-50 z-40"
          style={{ pointerEvents: 'auto' }}  onClick={onClose}
        />
       )}

        <dialog className='bg-transparent fixed top-0 bottom-0  z-50' open={isCategoryOpen}>  

            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[500px] w-[600px] rounded-md p-7 animate-popup" >

             <button  className='bg-blue-200' onClick={onClose}>X</button>
            
            </div>
           
        </dialog>

    </div>
  )
}

export default Category