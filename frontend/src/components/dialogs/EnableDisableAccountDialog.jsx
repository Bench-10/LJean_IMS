import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { FaSpinner } from "react-icons/fa";
import { MdOutlineDesktopAccessDisabled, MdOutlineDesktopWindows } from "react-icons/md";
import { IoMdClose } from "react-icons/io";

function EnableDisableAccountDialog({ onClose, status, action, loading = false }) {
  const isCurrentlyDisabled = !!status;      // true => disabled now
  const willEnable = isCurrentlyDisabled;    // next action
  const verb = willEnable ? "Enable" : "Disable";
  const progressText = willEnable ? "Enabling..." : "Disabling...";
  const description = willEnable
    ? "This account is currently disabled. Enabling will restore user access to the system."
    : "Disabling will immediately revoke this user's ability to log in and mark the account as inactive.";

  const styles = willEnable
    ? { iconWrap: "bg-green-100", icon: "text-green-600", title: "text-green-700", btn: "bg-green-600 hover:bg-green-700" }
    : { iconWrap: "bg-red-100", icon: "text-red-600", title: "text-red-700", btn: "bg-red-600 hover:bg-red-700" };

  const cancelRef = useRef(null);

  // Local pending to show "Enabling/Disabling…" immediately
  const [pending, setPending] = useState(false);
  const effectiveLoading = loading || pending;

  // ESC to close (no TS annotations)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !effectiveLoading) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [effectiveLoading, onClose]);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const handleAction = async () => {
    if (effectiveLoading) return;
    setPending(true); // show "…ing" immediately for both sync and async actions
    try {
      const maybe = action?.();
      if (maybe && typeof maybe.then === "function") {
        await maybe; // await promise if returned
      }
      // if action is sync, it already ran; we still showed the spinner briefly
    } finally {
      setPending(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[500] overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enable-disable-title"
      aria-describedby="enable-disable-desc"
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative min-h-full grid place-items-center p-4 sm:p-6"
        onClick={() => !effectiveLoading && onClose?.()}
      >
        <div
          className="w-full max-w-[92vw] sm:max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-popup"
          onClick={(e) => e.stopPropagation()}
          aria-busy={effectiveLoading}
        >
          <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${styles.iconWrap}`}>
              {willEnable ? (
                <MdOutlineDesktopWindows className={`text-2xl ${styles.icon}`} aria-hidden="true" />
              ) : (
                <MdOutlineDesktopAccessDisabled className={`text-2xl ${styles.icon}`} aria-hidden="true" />
              )}
            </div>
            <div className="flex-1">
              <h2 id="enable-disable-title" className={`text-lg font-semibold ${styles.title}`}>
                {willEnable ? "Enable Account" : "Disable Account"}
              </h2>
              <p id="enable-disable-desc" className="mt-1 text-sm text-gray-600 leading-relaxed">
                {description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => !effectiveLoading && onClose?.()}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition disabled:opacity-60"
              aria-label="Close"
              disabled={effectiveLoading}
            >
              <IoMdClose className="text-2xl" />
            </button>
          </div>

          <div className="px-4 sm:px-5 py-4 bg-gray-50 border-t">
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                ref={cancelRef}
                onClick={() => !effectiveLoading && onClose?.()}
                className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-60"
                disabled={effectiveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAction}
                className={`w-full sm:w-auto rounded-lg px-5 py-2 text-sm font-medium text-white inline-flex items-center justify-center gap-2 transition disabled:opacity-60 ${styles.btn}`}
                disabled={effectiveLoading}
                aria-live="polite"
              >
                {effectiveLoading && <FaSpinner className="animate-spin" aria-hidden="true" />}
                <span>{effectiveLoading ? progressText : verb}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default EnableDisableAccountDialog;
