import React from 'react';
import { MdWarningAmber } from 'react-icons/md';

function TooMuchAttempts({ open, onClose }) {
  if (!open) return null;
  return (

    <div className="fixed inset-0 z-50 flex items-start justify-center pt-44">
      {/*OVERLAY */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />


      {/*DIALOG */}
      <div className="relative w-full max-w-sm rounded-lg bg-white shadow-xl ring-1 ring-black/10 animate-popup">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
            
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mb-2">

            <MdWarningAmber className="text-3xl text-red-500" />

          </div>

          <h2 id="too-many-attempts-title" className="text-lg font-semibold text-red-500">Too Many Attempts</h2>
          <p className="text-sm text-gray-600">
            You have exceeded the maximum number of login attempts. The account associated with this email has been temporarily disabled.
          </p>

          <button

            type="button"
            onClick={onClose}
            className="mt-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-1"
          >
            Close

          </button>

        </div>

      </div>

    </div>

  );

}

export default TooMuchAttempts;
