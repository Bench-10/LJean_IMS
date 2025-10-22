import React from 'react';
import ReactDOM from 'react-dom';
import { IoAddCircle } from "react-icons/io5";
import { FaEdit } from "react-icons/fa";
import { MdDeleteOutline } from "react-icons/md";

function ConfirmationDialog({mode, message, submitFunction, onClose}) {
  return ReactDOM.createPortal(
    
      <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-44">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/35 bg-opacity-50 z-[9999] backdrop-blur-sm" 
              onClick={onClose}
            />  
            
            {/* Dialog */}
            <div 
              className="bg-white w-[500px] z-[10000] rounded-md animate-popup"
          
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${mode === "add" ? "bg-green-100  text-green-600" : mode === "edit" ? "bg-blue-100  text-blue-600" : "bg-red-100  text-red-600"} font-medium rounded-full flex items-center justify-center`}>
                    {mode === "add" ? <IoAddCircle /> : mode === "edit" ?  <FaEdit /> : <MdDeleteOutline /> } 
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {mode === 'add' ? "Confirm new data ?" : mode === 'edit' ? "Confirm changes ?" : "Delete Data ?" }
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
                  {message}
                </p>
      
                {/* Action buttons */}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={(e) => {submitFunction(); e.stopPropagation(); onClose();}}
                    className={`${mode === "add" ? "bg-green-600 hover:bg-green-700" : mode === "edit" ?"bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"}px-6 py-2  text-white rounded-lg transition-colors flex font-medium items-center gap-2 min-w-[100px] justify-center`}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>, document.body
    
  )
}

export default ConfirmationDialog
