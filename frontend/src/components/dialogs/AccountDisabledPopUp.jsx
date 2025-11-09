import React from 'react';
import { MdDesktopAccessDisabled, MdPersonRemove } from "react-icons/md";

function AccountDisabledPopUp({ open, type, onAction, onClose, user }) {
  if (!open) return null;

  const isDeleted = type === 'deleted';

  const content = isDeleted
    ? {
        icon: <MdPersonRemove className="text-4xl text-red-600" />,
        title: "Account Deleted",
        message:
          "Your account has been deleted by the administrator. You will be redirected to the login page.",
        buttonText: "OK",
        bgColor: "bg-red-100",
      }
    : {
        icon: <MdDesktopAccessDisabled className="text-4xl text-red-600" />,
        title: "Account Disabled",
        message: !user
          ? "Your account is currently disabled due to many failed login attempts."
          : "Your account has been disabled by the administrator. You have no access to your account this moment.",
        buttonText: "Logout",
        bgColor: "bg-red-100",
      };

  // Close icon behavior mirrors overlay:
  // - if there's NO user, it just closes the popup
  // - if there IS a user, it performs the action (e.g., logout)
  const handleCloseIcon = () => (!user ? onClose?.() : onAction?.());

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-44"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acct-popup-title"
      aria-describedby="acct-popup-desc"
    >
      {/* OVERLAY — click to close ONLY when there is NO user */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!user ? onClose : undefined}
        style={{ cursor: !user ? 'pointer' : 'default' }}
      />

      {/* DIALOG */}
      <div className="relative mx-auto w-full max-w-sm rounded-lg bg-white shadow-xl ring-1 ring-black/10 animate-popup">

        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full ${content.bgColor} mb-4`}>
              {content.icon}
            </div>
            <div className="space-y-1">
              <h2 id="acct-popup-title" className="text-xl font-semibold text-red-700 mb-2">
                {content.title}
              </h2>
              <p id="acct-popup-desc" className="text-sm text-gray-600">
                {content.message}
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => (!user ? onClose?.() : onAction?.())}
              className="rounded-md border border-gray-300 bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
            >
              {!user ? "Close" : content.buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountDisabledPopUp;
