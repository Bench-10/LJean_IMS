import React from 'react'

function InAppNotificationPopUp({title, message}) {

  const titleMap = {
    add: 'Added successfully!',
    edit: 'Updated successfully!',
    'New Notification': 'New Notification!',
    Success: 'Success!'
  };

  const displayTitle = titleMap[title] ?? (title || 'System Update');

  return (

     <div className='fixed top-7 right-5 bg-white p-4 rounded-lg shadow-2xl z-[1000] border border-gray-400 max-w-sm animate-slideInRight'>
      
        <p className="font-bold text-gray-800 mb-2">
            {displayTitle}
        </p>

        <p className="text-gray-600 text-sm">{message}</p>
        
    </div>

  )

}

export default InAppNotificationPopUp