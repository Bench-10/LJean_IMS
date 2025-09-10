import React, { useEffect, useRef } from 'react';
import { MdDesktopAccessDisabled } from "react-icons/md";


function AccountDisabledPopUp({ open, onClose }) {
  const dialogRef = useRef(null);

  

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 items-start justify-center pt-44" >
      {/*OVERLAY */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"

      />    

      {/*DIABLED ACCOUNT DIALOG*/}
      <div
       
        className="relative mx-auto w-full max-w-sm rounded-lg bg-white shadow-xl ring-1 ring-black/10 animate-popup"
      >

        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mb-4">
              <MdDesktopAccessDisabled className="text-4xl text-red-600" />
            </div>
            <div className="space-y-1">
              <h2 id="account-disabled-title" className="text-xl font-semibold text-red-700 mb-2">Account Disabled</h2>
              <p className="text-sm text-gray-600">
                {'This account is currently disabled. Please contact your system administrator for assistance or request reactivation.'}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="rounded-md border border-gray-300 bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
            >
              Close
            </button>
          </div>
        </div>

      </div>

    </div>

  );


}

export default AccountDisabledPopUp;