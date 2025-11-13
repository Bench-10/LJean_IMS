import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { FaSpinner } from "react-icons/fa";

/**
 * RejectionReasonDialog
 * - Shows a loading spinner and blocks closing while submitting
 * - Locks body scroll when open
 * - Use with a parent that: (1) awaits API, (2) closes dialog, then (3) refreshes + toasts
 */
function RejectionReasonDialog({
  open = false,
  title = "Reject Inventory Request",
  description = "Add an optional note explaining why this request is being rejected.",
  confirmLabel = "Submit",
  cancelLabel = "Cancel",
  onCancel,                    // () => void
  onConfirm,                   // (reason) => (void | Promise)
  initialReason = "",
  sanitizeInput,               // optional (value: string) => string
  loading: loadingProp = false,      // controlled loading from parent (boolean)
  loadingLabel = "Submitting…",
  blockCloseWhileLoading = true,     // prevent closing while loading
  zIndexClass = "z-[6000]",          // ensure above toasts
}) {
  const [reason, setReason] = useState(initialReason ?? "");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const openRef = useRef(open);

  // unified loading flag (parent-controlled OR internal)
  const loading = useMemo(
    () => Boolean(loadingProp) || submitting,
    [loadingProp, submitting]
  );

  // Reset & lock scroll on open
  useEffect(() => {
    if (!open) return;
    setReason(initialReason ?? "");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, initialReason]);

  // Focus textarea when opened
  useEffect(() => {
    if (open) textareaRef.current?.focus();
    openRef.current = open;
  }, [open]);

  // ESC to close (unless loading)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open && !(loading && blockCloseWhileLoading)) {
        onCancel?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, blockCloseWhileLoading, onCancel]);

  if (!open) return null;

  const handleChange = (e) => {
    const val = sanitizeInput ? sanitizeInput(e.target.value) : e.target.value;
    setReason(val);
  };

  const handleCancel = () => {
    if (loading && blockCloseWhileLoading) return;
    setReason(initialReason ?? "");
    onCancel?.();
  };

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    try {
      // Show loading in the dialog BEFORE any background update occurs
      setSubmitting(true);

      // Call the parent handler. If it returns a promise, await it.
      // If it returns synchronously (void), keep the dialog in a loading
      // state until the parent closes the dialog (open -> false) or a
      // sane timeout elapses. This covers cases where the parent fires an
      // async background task but doesn't return a promise.
      const maybePromise = onConfirm?.(trimmed);

      if (maybePromise && typeof maybePromise.then === "function") {
        await maybePromise;
      } else {
        // wait until parent closes dialog (open becomes false) or 10s timeout
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            if (!openRef.current) {
              clearInterval(interval);
              clearTimeout(timer);
              resolve();
            }
          }, 150);

          const timer = setTimeout(() => {
            clearInterval(interval);
            resolve();
          }, 10000);
        });
      }
      // IMPORTANT: Do not auto-close here.
      // Let the parent close the dialog FIRST, then refresh + toast (see example below).
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rejection-title"
      aria-describedby="rejection-desc"
      aria-busy={loading}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!(loading && blockCloseWhileLoading)) onCancel?.();
        }}
      />

      {/* Center */}
      <div className="relative min-h-full grid place-items-center p-4 sm:p-6">
        <div className="w-full max-w-[92vw] sm:max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 id="rejection-title" className="text-lg sm:text-xl font-semibold text-gray-900">
              {title}
            </h2>
            {description && (
              <p id="rejection-desc" className="mt-1 text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="rejection-reason"
            >
              Reason (optional)
            </label>
            <textarea
              id="rejection-reason"
              ref={textareaRef}
              rows={4}
              className="mt-2 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 shadow-sm resize-none disabled:opacity-60"
              placeholder="Provide additional context for this rejection"
              value={reason}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading && blockCloseWhileLoading}
            >
              {cancelLabel}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition
                         bg-red-600 hover:bg-red-700 inline-flex items-center justify-center gap-2
                         disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? <FaSpinner className="animate-spin" aria-hidden="true" /> : null}
              {loading ? loadingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default RejectionReasonDialog;
