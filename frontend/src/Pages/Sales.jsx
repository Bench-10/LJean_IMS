import React from 'react'

function Sales({setIsModalOpen}) {
  return (
    <div className='ml-[220px] flex justify-center items-center h-screen'>
            
        <button className='bg-green-600' onClick={() => setIsModalOpen(true)}>Add Sale</button>
        
    </div>
  )
}

export default Sales