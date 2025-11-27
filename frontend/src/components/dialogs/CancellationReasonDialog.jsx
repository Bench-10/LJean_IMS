import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import { FaSpinner } from "react-icons/fa";

/**
 * CancellationReasonDialog
 * - Shows a loading spinner and blocks closing while submitting
 * - Uses useModalLock to prevent background scroll and close on Back
 * - Parent is responsible for closing the dialog and then refreshing/toasting
 */
function CancellationReasonDialog({
  open = false,
  title = "Cancel Inventory Request",
  description = "Add an optional note explaining why this request is being cancelled.",
  confirmLabel = "Cancel Request",
  cancelLabel = "Keep Request",
  onCancel,
  onConfirm,
  initialReason = "",
  sanitizeInput,
  loading: loadingProp = false,
  loadingLabel = "Cancelling…",
  blockCloseWhileLoading = true,
  zIndexClass = "z-[10000]",
}) {
  const [reason, setReason] = useState(initialReason ?? "");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const openRef = useRef(open);

  // Unified loading flag (parent-controlled OR internal)
  const loading = useMemo(
    () => Boolean(loadingProp) || submitting,
    [loadingProp, submitting]
  );

  // Reset reason when opened
  useEffect(() => {
    if (!open) return;
    setReason(initialReason ?? "");
  }, [open, initialReason]);

  // Focus textarea when opened and keep openRef in sync
  useEffect(() => {
    if (open) textareaRef.current?.focus();
    openRef.current = open;
  }, [open]);

  const handleChange = useCallback(
    (e) => {
      const val = sanitizeInput ? sanitizeInput(e.target.value) : e.target.value;
      setReason(val);
    },
    [sanitizeInput]
  );

  const handleCancel = useCallback(() => {
    if (loading && blockCloseWhileLoading) return;
    setReason(initialReason ?? "");
    onCancel?.();
  }, [loading, blockCloseWhileLoading, initialReason, onCancel]);

  const handleConfirm = useCallback(async () => {
    const trimmed = reason.trim();
    try {
      setSubmitting(true);

      const maybePromise = onConfirm?.(trimmed);

      if (maybePromise && typeof maybePromise.then === "function") {
        await maybePromise;
      } else {
        // Wait until parent closes dialog (open becomes false) or 10s timeout
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
      // Parent is responsible for actually closing the dialog
    } finally {
      setSubmitting(false);
    }
  }, [reason, onConfirm]);

  // ESC to close (respect loading and blockCloseWhileLoading)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open && !(loading && blockCloseWhileLoading)) {
        handleCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, blockCloseWhileLoading, handleCancel]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancellation-title"
      aria-describedby="cancellation-desc"
      aria-busy={loading}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!(loading && blockCloseWhileLoading)) handleCancel();
        }}
      />

      {/* Center */}
      <div className="relative min-h-full grid place-items-center p-4 sm:p-6">
        <div className="w-full max-w-[92vw] sm:max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 id="cancellation-title" className="text-lg sm:text-xl font-semibold text-gray-900">
              {title}
            </h2>
            {description && (
              <p id="cancellation-desc" className="mt-1 text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="cancellation-reason"
            >
              Reason (optional)
            </label>
            <textarea
              id="cancellation-reason"
              ref={textareaRef}
              rows={4}
              className="mt-2 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 shadow-sm resize-none disabled:opacity-60"
              placeholder="Provide additional context for this cancellation"
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
                         bg-slate-600 hover:bg-slate-700 inline-flex items-center justify-center gap-2
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

export default CancellationReasonDialog;