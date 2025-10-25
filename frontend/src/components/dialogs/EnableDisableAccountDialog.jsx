import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FaSpinner } from 'react-icons/fa';
import { MdOutlineDesktopAccessDisabled, MdOutlineDesktopWindows } from 'react-icons/md';


function EnableDisableAccountDialog({onClose, status, action, loading = false }) {

  const isCurrentlyDisabled = !!status;
  const willEnable = isCurrentlyDisabled;

  const title = willEnable ? 'Enable Account' : 'Disable Account';
  const intentColor = willEnable ? 'green' : 'red';
  const primaryText = willEnable ? 'Enable' : 'Disable';
  const description = willEnable
    ? 'This account is currently disabled. Enabling will restore user access to the system.'
    : 'Disabling will immediately revoke this user\'s ability to log in and mark the account as inactive.';

 

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-44">

      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { if (!loading) onClose(); }}
      />


      <div className="relative w-full max-w-md animate-popup rounded-lg bg-white shadow-xl ring-1 ring-black/10">
      
        <div className="flex items-start gap-4 p-6">

          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-${intentColor}-100`}> 

            {willEnable ? (
              <MdOutlineDesktopWindows className={`text-2xl text-${intentColor}-600`} />
            ) : (
              <MdOutlineDesktopAccessDisabled className={`text-2xl text-${intentColor}-600`} />
            )}

          </div>

          <div className="flex flex-col gap-1">
            <h2 id="enable-disable-title" className={`text-lg font-semibold text-${intentColor}-700`}>{title}</h2>


            <p className="text-sm text-gray-600 leading-relaxed flex items-start gap-1">
               {description}
            </p>

          </div>


        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 rounded-b-lg">
          <button
            type="button"
            onClick={() => { if (!loading) onClose(); }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (!loading) action && action(); }}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white bg-${intentColor}-600 hover:bg-${intentColor}-700 flex items-center gap-2 disabled:opacity-60`}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && (
              <FaSpinner className="animate-spin" /> 
            )}
            <span>{loading ? `${primaryText}ing...` : primaryText}</span>
          </button>

        </div>

      </div>

    </div>, document.body


  );

}


export default EnableDisableAccountDialog;
