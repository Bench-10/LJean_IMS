import React, { useEffect, useRef } from 'react';
import { MdDesktopAccessDisabled, MdPersonRemove } from "react-icons/md";


function AccountDisabledPopUp({ open, type, onAction }) {
  const dialogRef = useRef(null);

  if (!open) return null;

  const isDeleted = type === 'deleted';
  const isDisabled = type === 'disabled';

  const getContent = () => {
    if (isDeleted) {
      return {
        icon: <MdPersonRemove className="text-4xl text-red-600" />,
        title: "Account Deleted",
        message: "Your account has been deleted by the administrator. You will be redirected to the login page.",
        buttonText: "OK",
        bgColor: "bg-red-100"
      };
    } else {
      return {
        icon: <MdDesktopAccessDisabled className="text-4xl text-red-600" />,
        title: "Account Disabled", 
        message: "Your account has been disabled by the administrator. You must logout now.",
        buttonText: "Logout",
        bgColor: "bg-red-100"
      };
    }
  };

  const content = getContent();

  return (
    <div className="fixed inset-0 z-50 items-start justify-center pt-44" >
      {/*OVERLAY - CANNOT BE CLICKED TO CLOSE */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />    

      {/*ACCOUNT DISABLED/DELETED DIALOG*/}
      <div className="relative mx-auto w-full max-w-sm rounded-lg bg-white shadow-xl ring-1 ring-black/10 animate-popup">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full ${content.bgColor} mb-4`}>
              {content.icon}
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-red-700 mb-2">{content.title}</h2>
              <p className="text-sm text-gray-600">
                {content.message}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onAction()}
              className="rounded-md border border-gray-300 bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
            >
              {content.buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountDisabledPopUp;