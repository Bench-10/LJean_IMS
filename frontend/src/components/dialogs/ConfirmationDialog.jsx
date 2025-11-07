import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { IoAddCircle } from "react-icons/io5";
import { FaEdit } from "react-icons/fa";
import { MdDeleteOutline } from "react-icons/md";

function ConfirmationDialog({ mode, message, submitFunction, onClose }) {
  const cancelRef = useRef(null);

  // Palette map (no dynamic Tailwind class strings)
  const styles =
    mode === "add"
      ? {
          iconWrap: "bg-green-100",
          icon: "text-green-600",
          btn: "bg-green-600 hover:bg-green-700",
          title: "text-gray-900",
        }
      : mode === "edit"
      ? {
          iconWrap: "bg-blue-100",
          icon: "text-blue-600",
          btn: "bg-blue-600 hover:bg-blue-700",
          title: "text-gray-900",
        }
      : {
          iconWrap: "bg-red-100",
          icon: "text-red-600",
          btn: "bg-red-600 hover:bg-red-700",
          title: "text-gray-900",
        };

  const title =
    mode === "add" ? "Confirm new data?" : mode === "edit" ? "Confirm changes?" : "Delete data?";

  // ESC to close
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Autofocus cancel
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[2147483647] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Centering + mobile padding */}
      <div className="relative min-h-full grid place-items-center p-4 sm:p-6">
        {/* Panel */}
        <div className="w-full max-w-[92vw] sm:max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.iconWrap}`}>
                {mode === "add" ? (
                  <IoAddCircle className={`text-xl ${styles.icon}`} aria-hidden="true" />
                ) : mode === "edit" ? (
                  <FaEdit className={`text-xl ${styles.icon}`} aria-hidden="true" />
                ) : (
                  <MdDeleteOutline className={`text-xl ${styles.icon}`} aria-hidden="true" />
                )}
              </div>
              <h2 id="confirm-title" className={`text-lg font-semibold ${styles.title}`}>
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-5">
            <p id="confirm-desc" className="text-gray-600 leading-relaxed">
              {message}
            </p>

            {/* Actions: stack on mobile, inline on sm+ */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                ref={cancelRef}
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  submitFunction?.();
                  e.stopPropagation();
                  onClose();
                }}
                className={`w-full sm:w-auto px-6 py-2 text-sm font-medium text-white rounded-lg transition inline-flex items-center justify-center ${styles.btn}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmationDialog;
