import React from 'react'

function ProductTransactionHistory({isProductTransactOpen, onClose}) {



  return (
    <div>
      
      {isProductTransactOpen && <div className='fixed inset-0 bg-black/35 bg-opacity-50 z-40'/>}

      <dialog className='bg-transparent fixed top-0 bottom-0  z-50' open={isProductTransactOpen}>

          <div className="relative flex flex-col border border-gray-600/40 bg-white h-[600px] w-[1000px] rounded-md p-7 pb-14 border-gray-300 animate-popup">
            <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
              onClick={() => {onClose();}}>✕</button>

          </div>

            
      </dialog>
    </div>
  )
}

export default ProductTransactionHistory