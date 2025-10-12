import { useEffect, useState } from "react";

function RejectionReasonDialog({
  open = false,
  title = "Reject Inventory Request",
  description = "Add an optional note explaining why this request is being rejected.",
  confirmLabel = "Submit",
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
  initialReason = "",
  sanitizeInput
}) {
  const [reason, setReason] = useState(initialReason ?? "");

  useEffect(() => {
    if (open) {
      setReason(initialReason ?? "");
    }
  }, [open, initialReason]);

  if (!open) {
    return null;
  }

  const handleChange = (event) => {
    const value = sanitizeInput ? sanitizeInput(event.target.value) : event.target.value;
    setReason(value);
  };

  const handleCancel = () => {
    setReason(initialReason ?? "");
    onCancel?.();
  };

  const handleConfirm = () => {
    onConfirm?.(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>

        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-gray-700" htmlFor="rejection-reason">
            Reason (optional)
          </label>
          <textarea
            id="rejection-reason"
            name="rejection-reason"
            rows={4}
            className="mt-2 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 shadow-sm resize-none"
            placeholder="Provide additional context for this rejection"
            value={reason}
            onChange={handleChange}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            onClick={handleCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RejectionReasonDialog;
