import React, { useEffect, useState } from 'react';
import DropdownCustom from '../DropdownCustom';

const CHANGE_TYPE_OPTIONS = [
  { value: 'quantity', label: 'Quantity' },
  { value: 'product_info', label: 'Product information' },
  { value: 'other', label: 'Other' },
];

const RequestChangeDialog = ({
  open,
  onCancel,
  onConfirm,
  loading = false,
  initialChangeType = 'quantity',
  initialComment = '',
  pendingId = null,
}) => {
  const [changeType, setChangeType] = useState(initialChangeType);
  const [comment, setComment] = useState(initialComment);
  const [touched, setTouched] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  useEffect(() => {
    if (open) {
      setChangeType(initialChangeType || 'quantity');
      setComment(initialComment || '');
      setTouched(false);
      setAttemptedSubmit(false);
    }
  }, [open, initialChangeType, initialComment]);

  if (!open) return null;

  const isCommentEmpty = comment.trim().length === 0;
  const showCommentError = (touched || attemptedSubmit) && isCommentEmpty;

  return (
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/40"
      onClick={() => (loading ? null : onCancel && onCancel())}
    >
      <div
        className="relative w-[min(680px,95%)] rounded-2xl bg-white p-6 animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-800">Request Changes</h3>
        <p className="mt-1 text-sm text-gray-500">
          Ask to make changes to their pending request.
        </p>

        {/* Change type - DropdownCustom (default variant) */}
        <div className="mt-4">
          <DropdownCustom
            label="Change type"
            value={changeType}
            onChange={(e) => setChangeType(e.target.value)}
            options={CHANGE_TYPE_OPTIONS}
            variant="default"
            size="md"
          />
        </div>

        {/* Comment (required, input only) */}
        <div className="mt-4">
          <label className="text-xs text-gray-600">
            Comment <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => setTouched(true)}
            className={`mt-1 w-full rounded border px-2 py-2 text-sm focus:outline-none focus:ring-1 ${
              showCommentError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-500'
            }`}
            placeholder="Tell the user what's required (e.g., update quantity, fix product name)"
            data-testid="request-change-comment"
            aria-required="true"
            aria-invalid={showCommentError ? 'true' : 'false'}
          />
          {showCommentError && (
            <div className="mt-2 text-sm text-red-600">
              Comment is required to request changes.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm text-white ${
              isCommentEmpty
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
            onClick={() => {
              setAttemptedSubmit(true);
              if (loading) return;
              if (isCommentEmpty) return;
              onConfirm && onConfirm(pendingId, changeType, comment.trim());
            }}
            disabled={loading || isCommentEmpty}
          >
            {loading ? 'Sending…' : 'Send change request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestChangeDialog;
