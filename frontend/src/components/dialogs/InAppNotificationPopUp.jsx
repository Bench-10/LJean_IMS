import React, { useEffect, useState } from 'react'

function InAppNotificationPopUp({title, message}) {


  return (

     <div className='fixed top-7 right-5 bg-white p-4 rounded-lg shadow-2xl z-[1000] border border-gray-400 max-w-sm animate-slideInRight'>
        <p className="font-bold text-gray-800 mb-4">

            { title === 'add' ? 'Added succesfully!' : title === 'edit' ? 'Update successfully!' : 'New Notification!'}
       
        </p>

        <p className="text-gray-600 text-sm">{message}</p>
    </div>

  )

}

export default InAppNotificationPopUp