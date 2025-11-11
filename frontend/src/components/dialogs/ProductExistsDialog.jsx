import React from 'react';
import ReactDOM from 'react-dom';
import { IoWarning } from "react-icons/io5";
import { IoMdClose } from "react-icons/io";

function ProductExistsDialog({ isOpen, message, onClose }) {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-44">
      {/* OVERLAY */}
      <div
        className="fixed inset-0 bg-black/35 bg-opacity-50 z-[9999] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* DIALOG */}
      <div
        className="bg-white w-[450px] z-[10000] rounded-lg animate-popup"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-exists-title"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 font-medium rounded-full flex items-center justify-center">
              <IoWarning size={20} />
            </div>
            <h2 id="product-exists-title" className="text-xl font-semibold text-gray-900">
              Product Already Exists
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <IoMdClose size={22} />
          </button>
        </div>

        {/* MESSAGE */}
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            {message || 'This product already exists in the inventory.'}
          </p>

          {/* ACTIONS */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ProductExistsDialog;
