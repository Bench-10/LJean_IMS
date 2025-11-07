import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { MdOutlinePendingActions } from "react-icons/md";

function PendingRequestsGuardDialog({
  open = false,
  message = "",
  onCancel,
  onReview,
  userName,
  roleHint,
  userPendingDescription,
  showReviewButton = true,
  reviewLabel = "Review requests"
}) {
  const panelRef = useRef(null);
  const reviewButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const focusTimer = setTimeout(() => {
      if (showReviewButton && reviewButtonRef.current) {
        reviewButtonRef.current.focus();
      } else if (cancelButtonRef.current) {
        cancelButtonRef.current.focus();
      }
    }, 40);

    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
      }

      if (event.key === "Tab") {
        const focusable = panelRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusable || focusable.length === 0) {
          return;
        }

        const elements = Array.from(focusable);
        const first = elements[0];
        const last = elements[elements.length - 1];

        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onCancel, showReviewButton]);

  if (!open) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[2147483600] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-guard-title"
      aria-describedby="pending-guard-message"
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onCancel} />

      <div
        ref={panelRef}
        className="relative w-full max-w-xl rounded-2xl shadow-2xl border border-amber-200 bg-white overflow-hidden"
      >
        <div className="px-5 sm:px-6 py-5 border-b border-amber-200 flex items-start gap-4 bg-amber-50">
          <div className="shrink-0 w-11 h-11 rounded-full bg-amber-200 flex items-center justify-center">
            <MdOutlinePendingActions className="text-amber-700 text-2xl" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 id="pending-guard-title" className="text-lg sm:text-xl font-semibold text-amber-900">
              Pending requests need attention
            </h2>
            {roleHint ? (
              <p className="text-sm text-amber-800/90">
                {roleHint}
              </p>
            ) : null}
          </div>
        </div>

        <div className="px-5 sm:px-6 py-6 space-y-4">
          {userName ? (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{userName}</span> {userPendingDescription || "still has requests awaiting a decision."}
            </p>
          ) : null}
          <p id="pending-guard-message" className="text-base text-gray-700 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="px-5 sm:px-6 pb-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Cancel
          </button>
          {showReviewButton ? (
            <button
              ref={reviewButtonRef}
              type="button"
              onClick={onReview}
              className="w-full sm:w-auto px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-sm transition"
            >
              {reviewLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default PendingRequestsGuardDialog;
