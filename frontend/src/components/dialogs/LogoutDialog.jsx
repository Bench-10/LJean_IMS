import React, { useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { MdOutlineLogout } from "react-icons/md";
import { FaSpinner } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import useModalLock from "../../hooks/useModalLock";

function LogoutDialog({ onClose, logout, loading = false }) {
  const cancelRef = useRef(null);
  const loadingRef = useRef(loading);

  // Keep latest loading in a ref for stable callbacks
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // This is what should happen when "back" is pressed
  const handleBack = useCallback(() => {
    if (!loadingRef.current) {
      onClose();
    }
  }, [onClose]);

  // 🔒 Lock scroll + intercept BACK while this dialog is mounted
  // (component only renders when it's open, so isOpen=true)
  useModalLock(true, handleBack);

  // Close on ESC (unless loading)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !loadingRef.current) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Autofocus "Cancel"
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[500]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      aria-describedby="logout-desc"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!loadingRef.current) onClose();
        }}
      />

      {/* Centering layer */}
      <div
        className="absolute inset-0 p-4 sm:p-6 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog panel */}
        <div className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-popup">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                <MdOutlineLogout className="text-xl" aria-hidden="true" />
              </div>
              <h2 id="logout-title" className="text-lg font-semibold text-gray-900">
                Confirm logout?
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!loadingRef.current) onClose();
              }}
              aria-label="Close"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition disabled:opacity-60"
              disabled={loading}
            >
              <IoMdClose className="text-2xl" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-5">
            <p id="logout-desc" className="text-gray-600">
              Are you sure you want to log out? You’ll need to sign in again to access your account.
            </p>

            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                ref={cancelRef}
                onClick={() => {
                  if (!loadingRef.current) onClose();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={logout}
                className="w-full sm:w-auto px-5 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin" aria-hidden="true" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <MdOutlineLogout aria-hidden="true" />
                    Logout
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default LogoutDialog;
