import React, { 
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MdRefresh, MdHistory } from 'react-icons/md';
import { FaBoxOpen } from 'react-icons/fa6';
import { useAuth } from '../authentication/Authentication';
import ChartLoading from '../components/common/ChartLoading.jsx';
import RejectionReasonDialog from '../components/dialogs/RejectionReasonDialog.jsx';
import InventoryRequestHistoryModal from '../components/InventoryRequestHistoryModal.jsx';
import RequestChangeDialog from '../components/dialogs/RequestChangeDialog.jsx';

const normalizeId = (value) =>
  value === null || value === undefined ? null : String(value);

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
};

function PendingInventoryRequests({
  pendingRequests = [],
  pendingRequestsLoading = false,
  approvePendingRequest,
  rejectPendingRequest,
  refreshPendingRequests,
  sanitizeInput,
  onRequestChanges,
  highlightDirective = null,
  onHighlightConsumed,
}) {
  const { user } = useAuth();

  const [approvingIds, setApprovingIds] = useState(() => new Set());
  const [rejectingIds, setRejectingIds] = useState(() => new Set());

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [pendingRejectId, setPendingRejectId] = useState(null);

  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [changeDialogContext, setChangeDialogContext] = useState({
    pendingId: null,
    changeType: 'quantity',
    comment: '',
  });
  const [changeDialogLoading, setChangeDialogLoading] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryPendingId, setSelectedHistoryPendingId] =
    useState(null);

  const [highlightedPendingIds, setHighlightedPendingIds] = useState([]);

  const listContainerRef = useRef(null);
  const requestRefs = useRef(new Map());
  const lastHighlightTokenRef = useRef(null);

  const roles = useMemo(
    () =>
      Array.isArray(user?.role)
        ? user.role
        : user?.role
        ? [user.role]
        : [],
    [user]
  );
  const canRequestChanges = roles.includes('Branch Manager');

  const isApproving = useCallback(
    (pendingId) => approvingIds.has(normalizeId(pendingId)),
    [approvingIds]
  );
  const isRejecting = useCallback(
    (pendingId) => rejectingIds.has(normalizeId(pendingId)),
    [rejectingIds]
  );
  const isProcessing = useCallback(
    (pendingId) => isApproving(pendingId) || isRejecting(pendingId),
    [isApproving, isRejecting]
  );

  useEffect(() => {
    if (typeof refreshPendingRequests === 'function') {
      refreshPendingRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRequestRef = useCallback((pendingId, node) => {
    const key = normalizeId(pendingId);
    if (!key) return;
    if (node) {
      requestRefs.current.set(key, node);
    } else {
      requestRefs.current.delete(key);
    }
  }, []);

  const scrollIntoView = useCallback((pendingId) => {
    const key = normalizeId(pendingId);
    if (!key) return;
    const node = requestRefs.current.get(key);
    if (!node) return;

    const container = listContainerRef.current;
    if (
      container &&
      typeof container.scrollTo === 'function' &&
      container.contains(node)
    ) {
      const offset = node.offsetTop - container.offsetTop;
      container.scrollTo({
        top: Math.max(offset - container.clientHeight / 3, 0),
        behavior: 'smooth',
      });
      return;
    }

    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (!highlightDirective || highlightDirective.type !== 'branch-pending') {
      return undefined;
    }
    if (pendingRequestsLoading) return undefined;

    const triggerToken = highlightDirective.triggeredAt ?? Date.now();
    if (lastHighlightTokenRef.current === triggerToken) return undefined;

    const availableIds = new Set(
      (Array.isArray(pendingRequests) ? pendingRequests : [])
        .map((req) => normalizeId(req.pending_id))
        .filter(Boolean)
    );

    const directiveIds = Array.isArray(highlightDirective.targetIds)
      ? highlightDirective.targetIds
          .map(normalizeId)
          .filter((id) => id && availableIds.has(id))
      : [];

    let matches = directiveIds;

    if (matches.length === 0) {
      const targetUserId = Number(highlightDirective.userId);
      const normalizedName = String(
        highlightDirective.userName || ''
      )
        .trim()
        .toLowerCase();

      matches = (Array.isArray(pendingRequests) ? pendingRequests : [])
        .filter((request) => {
          const createdByCandidate = Number(
            request?.created_by ??
              request?.created_by_id ??
              request?.inventory_staff_id ??
              null
          );

          if (Number.isFinite(targetUserId) && createdByCandidate === targetUserId) {
            return true;
          }

          if (normalizedName) {
            return (
              String(request?.created_by_name || '')
                .trim()
                .toLowerCase() === normalizedName
            );
          }

          return false;
        })
        .map((request) => normalizeId(request.pending_id))
        .filter((id) => id && availableIds.has(id));
    }

    if (matches.length === 0) {
      onHighlightConsumed?.('branch-pending');
      return undefined;
    }

    lastHighlightTokenRef.current = triggerToken;
    setHighlightedPendingIds(matches);

    const scrollTimer = window.setTimeout(() => {
      if (matches[0]) {
        scrollIntoView(matches[0]);
      }
    }, 140);

    const fadeTimer = window.setTimeout(() => {
      setHighlightedPendingIds([]);
    }, 6000);

    onHighlightConsumed?.('branch-pending');

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(fadeTimer);
    };
  }, [
    highlightDirective,
    onHighlightConsumed,
    pendingRequests,
    pendingRequestsLoading,
    scrollIntoView,
  ]);

  const handleApproveClick = useCallback(
    (pendingId) => {
      if (typeof approvePendingRequest !== 'function') return;
      const key = normalizeId(pendingId);
      if (!key) return;

      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      (async () => {
        try {
          await approvePendingRequest(pendingId);
        } finally {
          setApprovingIds((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      })();
    },
    [approvePendingRequest]
  );

  const handleRejectClick = useCallback(
    (pendingId) => {
      if (typeof rejectPendingRequest !== 'function') return;
      setPendingRejectId(pendingId);
      setIsRejectDialogOpen(true);
    },
    [rejectPendingRequest]
  );

  const handleRejectDialogCancel = useCallback(() => {
    setIsRejectDialogOpen(false);
    setPendingRejectId(null);
  }, []);

  const handleRejectDialogConfirm = useCallback(
    (reason) => {
      if (typeof rejectPendingRequest !== 'function' || pendingRejectId == null) {
        handleRejectDialogCancel();
        return;
      }

      const key = normalizeId(pendingRejectId);
      setRejectingIds((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      (async () => {
        try {
          await rejectPendingRequest(pendingRejectId, reason);
        } finally {
          setRejectingIds((prev) => {
            const next = new Set(prev);
            if (key) next.delete(key);
            return next;
          });
          handleRejectDialogCancel();
        }
      })();
    },
    [handleRejectDialogCancel, pendingRejectId, rejectPendingRequest]
  );

  const handleRequestChangesClick = useCallback((pendingId) => {
    setChangeDialogContext({
      pendingId,
      changeType: 'quantity',
      comment: '',
    });
    setChangeDialogOpen(true);
  }, []);

  const handleChangeDialogCancel = useCallback(() => {
    if (changeDialogLoading) return;
    setChangeDialogOpen(false);
    setChangeDialogContext({
      pendingId: null,
      changeType: 'quantity',
      comment: '',
    });
  }, [changeDialogLoading]);

  const handleChangeDialogConfirm = useCallback(
    async (pendingId, changeType, comment) => {
      const key = normalizeId(pendingId);
      if (!key) {
        handleChangeDialogCancel();
        return;
      }

      setChangeDialogLoading(true);
      try {
        if (typeof onRequestChanges === 'function') {
          await onRequestChanges(pendingId, changeType, comment);
        }
        if (typeof refreshPendingRequests === 'function') {
          await refreshPendingRequests();
        }
      } finally {
        setChangeDialogLoading(false);
        handleChangeDialogCancel();
      }
    },
    [handleChangeDialogCancel, onRequestChanges, refreshPendingRequests]
  );

  const openHistoryModal = useCallback((pendingId) => {
    setSelectedHistoryPendingId(pendingId);
    setHistoryModalOpen(true);
  }, []);

  const closeHistoryModal = useCallback(() => {
    setSelectedHistoryPendingId(null);
    setHistoryModalOpen(false);
  }, []);

  const sortedRequests = useMemo(
    () =>
      (Array.isArray(pendingRequests) ? [...pendingRequests] : []).sort(
        (a, b) => {
          const timeA = Date.parse(a?.created_at || '') || 0;
          const timeB = Date.parse(b?.created_at || '') || 0;
          return timeB - timeA;
        }
      ),
    [pendingRequests]
  );

  const pendingCount = sortedRequests.length;

  return (
    <div className="pt-20 lg:pt-7 px-4 lg:px-8 pb-8">
      {/* Header block with full-width bar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[33px] leading-tight font-bold text-green-900">
              PENDING INVENTORY REQUESTS
            </h1>
          </div>

          {/* RIGHT SIDE: REFRESH ICON ONLY */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => refreshPendingRequests?.()}
                disabled={pendingRequestsLoading}
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-green-400 bg-green-600 p-2 text-sm font-semibold text-white shadow-sm transition enabled:hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                title="Refresh pending requests"
                aria-label="Refresh pending requests"
              >
                <MdRefresh
                  className={
                    pendingRequestsLoading ? 'animate-spin text-base' : 'text-base'
                  }
                />
              </button>
            </div>

            {pendingRequestsLoading && (
              <span className="text-xs text-gray-500">
                Loading latest requests…
              </span>
            )}
          </div>
        </div>

        {/* full-width horizontal bar, like INVENTORY */}
        <div className="h-[3.5px] w-full bg-green-800" />
      </div>

      {/* List container */}
      <div
        className="mt-6 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm"
        ref={listContainerRef}
      >
        {pendingRequestsLoading ? (
          <div className="py-12 px-6">
            <ChartLoading message="Loading pending inventory approvals..." />
          </div>
        ) : pendingCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FaBoxOpen className="text-5xl text-emerald-300" />
            <p className="text-sm text-gray-600">No pending requests right now.</p>
          </div>
        ) : (
          <div className="space-y-4 p-4 sm:p-6">
            {sortedRequests.map((request) => {
              const key = normalizeId(request.pending_id);
              const payload = request?.payload || {};
              const requestedProduct = payload?.productData || payload || {};
              const currentState = payload?.currentState;
              const isHighlighted = key
                ? highlightedPendingIds.includes(key)
                : false;

              return (
                <div
                  key={key || request.pending_id || Math.random().toString(36)}
                  ref={(node) => setRequestRef(key, node)}
                  className={`border bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition ${
                    isHighlighted
                      ? 'border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.45)] animate-pulse'
                      : ''
                  }`}
                >
                  {/* Header row with meta + request changes + timeline icon */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                          {request?.action_type === 'update' ? 'Update' : 'Add'}
                        </span>
                        <span className="text-gray-500 normal-case font-medium">
                          Requested {formatDateTime(request?.created_at)}
                        </span>
                        {request?.requires_admin_review && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">
                            Owner approval required
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-semibold text-gray-800">
                        {requestedProduct?.product_name || 'Unnamed Product'}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Submitted by {request?.created_by_name || 'Inventory Staff'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {canRequestChanges && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRequestChangesClick(request.pending_id)
                          }
                          disabled={
                            isProcessing(request.pending_id) || changeDialogLoading
                          }
                          className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Request changes
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openHistoryModal(request.pending_id)}
                        className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-700 transition hover:bg-gray-100"
                        title="View request timeline"
                        aria-label="View request timeline"
                      >
                        <MdHistory className="text-lg" />
                      </button>
                    </div>
                  </div>

                  {/* Body: requested vs current values */}
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                        Requested update
                      </p>
                      <ul className="space-y-1">
                        {requestedProduct?.quantity_added != null && (
                          <li>
                            <span className="font-medium">Quantity:</span>{' '}
                            {currentState
                              ? `${Number(
                                  currentState.quantity
                                ).toLocaleString()} + `
                              : ''}
                            <span className="font-bold">
                              {requestedProduct.quantity_added}
                            </span>{' '}
                            {requestedProduct.unit ?? ''}
                          </li>
                        )}
                        {requestedProduct?.unit_price != null && (
                          <li>
                            <span className="font-medium">Unit Price:</span> ₱{' '}
                            {Number(
                              requestedProduct.unit_price
                            ).toLocaleString()}
                          </li>
                        )}
                        {requestedProduct?.unit_cost != null && (
                          <li>
                            <span className="font-medium">Unit Cost:</span> ₱{' '}
                            {Number(
                              requestedProduct.unit_cost
                            ).toLocaleString()}
                          </li>
                        )}
                        {(requestedProduct?.min_threshold != null ||
                          requestedProduct?.max_threshold != null) && (
                          <li>
                            <span className="font-medium">Threshold:</span>{' '}
                            {requestedProduct.min_threshold} -{' '}
                            {requestedProduct.max_threshold}
                          </li>
                        )}
                        {requestedProduct?.product_validity && (
                          <li>
                            <span className="font-medium">Validity:</span>{' '}
                            {requestedProduct.product_validity}
                          </li>
                        )}
                        {requestedProduct?.description && (
                          <li>
                            <span className="font-medium">Description:</span>{' '}
                            {requestedProduct.description}
                          </li>
                        )}
                      </ul>
                    </div>

                    {currentState && (
                      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                          Current values
                        </p>
                        <ul className="space-y-1">
                          <li>
                            <span className="font-medium">Quantity:</span>{' '}
                            {Number(currentState.quantity).toLocaleString()}{' '}
                            {currentState.unit}
                          </li>
                          <li>
                            <span className="font-medium">Unit Price:</span> ₱{' '}
                            {Number(currentState.unit_price).toLocaleString()}
                          </li>
                          <li>
                            <span className="font-medium">Unit Cost:</span> ₱{' '}
                            {Number(currentState.unit_cost).toLocaleString()}
                          </li>
                          <li>
                            <span className="font-medium">Threshold:</span>{' '}
                            {currentState.min_threshold} -{' '}
                            {currentState.max_threshold}
                          </li>
                          {currentState.product_validity && (
                            <li>
                              <span className="font-medium">Validity:</span>{' '}
                              {currentState.product_validity}
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Footer: approve/reject bottom-right */}
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveClick(request.pending_id)}
                      disabled={isProcessing(request.pending_id)}
                      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
                        isProcessing(request.pending_id)
                          ? 'bg-green-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {isApproving(request.pending_id) ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Processing
                        </span>
                      ) : (
                        'Approve'
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRejectClick(request.pending_id)}
                      disabled={isProcessing(request.pending_id)}
                      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
                        isProcessing(request.pending_id)
                          ? 'bg-red-300 cursor-not-allowed'
                          : 'bg-red-500 hover:bg-red-600'
                      }`}
                    >
                      {isRejecting(request.pending_id) ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Processing
                        </span>
                      ) : (
                        'Reject'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RejectionReasonDialog
        open={isRejectDialogOpen}
        onCancel={handleRejectDialogCancel}
        onConfirm={handleRejectDialogConfirm}
        sanitizeInput={sanitizeInput}
        title="Reject Inventory Request"
        confirmLabel="Submit Rejection"
      />

      <RequestChangeDialog
        open={changeDialogOpen}
        onCancel={handleChangeDialogCancel}
        onConfirm={handleChangeDialogConfirm}
        loading={changeDialogLoading}
        initialChangeType={changeDialogContext.changeType}
        initialComment={changeDialogContext.comment}
        pendingId={changeDialogContext.pendingId}
      />

      <InventoryRequestHistoryModal
        open={historyModalOpen}
        onClose={closeHistoryModal}
        pendingId={selectedHistoryPendingId}
        formatDateTime={formatDateTime}
      />
    </div>
  );
}

export default PendingInventoryRequests;
