import React, { useEffect, useState } from 'react';

const RequestChangeDialog = ({ open, onCancel, onConfirm, loading = false, initialChangeType = 'quantity', initialComment = '', pendingId = null }) => {
  const [changeType, setChangeType] = useState(initialChangeType);
  const [comment, setComment] = useState(initialComment);

  useEffect(() => {
    if (open) {
      setChangeType(initialChangeType || 'quantity');
      setComment(initialComment || '');
    }
  }, [open, initialChangeType, initialComment]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/40" onClick={() => (loading ? null : onCancel && onCancel())}>
      <div className="relative w-[min(680px,95%)] rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-800">Request Changes</h3>
        <p className="text-sm text-gray-500 mt-1">Ask the requester to make changes to their pending request.</p>
        <div className="mt-4">
          <label className="text-xs text-gray-600">Change type</label>
          <select
            value={changeType}
            onChange={(e) => setChangeType(e.target.value)}
            className="mt-1 w-full rounded border p-2"
            data-testid="request-change-type"
          >
            <option value="quantity">Quantity</option>
            <option value="product_info">Product information</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="mt-4">
          <label className="text-xs text-gray-600">Comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full rounded border p-2 h-28"
            placeholder="Tell the user what's required (e.g., update quantity, fix product name)"
            data-testid="request-change-comment"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-md border px-4 py-2 text-sm" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white"
            onClick={() => onConfirm && onConfirm(pendingId, changeType, comment)}
            disabled={loading}
          >
            {loading ? 'Sending…' : 'Send change request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestChangeDialog;
