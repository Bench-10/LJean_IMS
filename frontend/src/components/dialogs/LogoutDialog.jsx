import React from 'react';
import { MdOutlineLogout } from "react-icons/md";
import ReactDOM from 'react-dom';


function LogoutDialog({onClose, logout }) {

 
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-44">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/35 bg-opacity-50 z-100 backdrop-blur-sm" 
        onClick={onClose}
      />  
      
      {/* Dialog */}
      <div 
        className="bg-transparent bg-white w-[500px] z-200 rounded-md animate-popup"
    
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 text-red-600 font-medium rounded-full flex items-center justify-center">
              <MdOutlineLogout />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Confirm Logout ?
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Are you sure you want to log out? You'll need to sign in again to access your account.
          </p>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={logout}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 min-w-[100px] justify-center font-medium"
            >
              Logout
            </button>

          </div>

        </div>

      </div>

    </div>,

    document.body

  )

}

export default LogoutDialog
