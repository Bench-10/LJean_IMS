import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/api';
import { currencyFormat } from '../../utils/formatCurrency.js';
import ChartLoading from '../common/ChartLoading.jsx';
// Adjust path if needed
import DropdownCustom from '../DropdownCustom';
import { IoMdClose } from "react-icons/io";
import { MdRefresh } from 'react-icons/md';
import useModalLock from '../../hooks/useModalLock';
import CancellationReasonDialog from './CancellationReasonDialog';
import InventoryRequestHistoryModal from '../InventoryRequestHistoryModal'; 

const toneStyles = {
  slate:   { badge: 'border-slate-200 bg-slate-50 text-slate-700',   dot: 'bg-slate-500' },
  emerald: { badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  rose:    { badge: 'border-rose-200 bg-rose-50 text-rose-700',      dot: 'bg-rose-500' },
  amber:   { badge: 'border-amber-200 bg-amber-50 text-amber-700',   dot: 'bg-amber-500' },
  blue:    { badge: 'border-blue-200 bg-blue-50 text-blue-700',      dot: 'bg-blue-500' }
};

// Merged: single Pending
const statusFilters = [
  { id: 'pending',  label: 'Pending' },
  { id: 'changes_requested', label: 'Requires changes' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' }
];

const requestTypeFilters = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'user',      label: 'User Accounts' }
];

const PAGE_SIZE = 12;

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const formatNumber = (v) => (v === null || v === undefined || !Number.isFinite(Number(v))) ? '—' : numberFormatter.format(Number(v));
const formatCurrencyValue = (v) => (v === null || v === undefined || !Number.isFinite(Number(v))) ? 'N/A' : currencyFormat(Number(v));
const formatDateTime = (v) => { const d = new Date(v || ''); return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d); };
const toISOStringSafe = (v) => { const d = new Date(v || ''); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const toTime = (v) => { const d = new Date(v || ''); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); };

const normalizeRoleArray = (roles) => {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles.filter(Boolean);
  if (typeof roles === 'string') return roles.split(',').map((r) => r.trim()).filter(Boolean);
  return [];
};
const normalizeComparableString = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
const findBranchName = (branches, branchId) => {
  if (!branchId) return null;
  const numeric = Number(branchId);
  return branches.find((b) => Number(b.branch_id) === numeric)?.branch_name || null;
};

const InventoryRequestMonitorDialog = ({
  open,
  onClose,
  user,
  branches = [],
  userRequests = [],
  userRequestsLoading = false,
  refreshToken = 0,
  onCancelInventoryRequest,
  onCancelUserRequest,
  onRequestChanges,
  onOpenEditRequest
}) => {
  // Lock scroll + intercept BACK to close the modal instead of navigating away
  useModalLock(open, onClose);  // important: pass onClose here

  const roleList = useMemo(() => {
    if (!user || !user.role) return [];
    return Array.isArray(user.role) ? user.role : [user.role];
  }, [user]);


  const isOwnerUser     = roleList.includes('Owner');
  const isBranchManager = roleList.includes('Branch Manager');
  const canViewAdmin    = isOwnerUser;                 // Owner can filter by branch
  const canSeeTypeFilter = isBranchManager || isOwnerUser; // Type visible to BM & Owner
  const typeEnabled = canSeeTypeFilter;                // ALWAYS enabled when visible
  const currentUserId = useMemo(() => {
    const candidate = Number(user?.user_id);
    return Number.isFinite(candidate) ? candidate : null;
  }, [user]);

  // Internal scope (no UI)
  const defaultScope = useMemo(() => (isOwnerUser ? 'admin' : (isBranchManager ? 'branch' : 'user')), [isOwnerUser, isBranchManager]);
  const [scope, setScope] = useState(defaultScope);

  const [branchFilter, setBranchFilter] = useState(() => {
    if (defaultScope === 'branch') {
      if (canViewAdmin && branches.length > 0) return String(branches[0].branch_id);
      if (user?.branch_id) return String(user.branch_id);
    }
    return '';
  });

  // '' => show all
  const [statusFilter, setStatusFilter] = useState('');
  const [requestTypeFilter, setRequestTypeFilter] = useState('');

  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [cancelError, setCancelError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const lastRefreshTokenRef = useRef(refreshToken);
  const [showRefreshIndicator, setShowRefreshIndicator] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelDialogContext, setCancelDialogContext] = useState({ pendingId: null });
  const [cancelDialogLoading, setCancelDialogLoading] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [changeDialogContext, setChangeDialogContext] = useState({ pendingId: null, changeType: 'quantity', comment: '' });
  const [changeDialogLoading, setChangeDialogLoading] = useState(false);

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryPendingId, setSelectedHistoryPendingId] = useState(null);

  const triggerRefresh = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  // On open: default to 'pending' + 'inventory' to show pending inventory requests
  useEffect(() => {
    if (!open) return;
    setBranchFilter(''); // Clear branch filter to show ALL
    // Default to showing pending inventory requests when the dialog opens
    setStatusFilter('pending');
    setRequestTypeFilter('inventory');
  }, [open]);

  useEffect(() => {
    if (!open) { setVisibleCount(PAGE_SIZE); return; }
    setScope((prev) => (prev === defaultScope ? prev : defaultScope));
  }, [defaultScope, open]);

  useEffect(() => {
    if (!open) {
      lastRefreshTokenRef.current = refreshToken;
      return;
    }

    if (refreshToken === undefined || refreshToken === null) {
      return;
    }

    // Always trigger refresh when refreshToken changes and dialog is open
    if (lastRefreshTokenRef.current !== refreshToken) {
      lastRefreshTokenRef.current = refreshToken;
      console.log('🔄 WebSocket event detected - refreshing inventory request status');
      
      // Show brief refresh indicator
      setShowRefreshIndicator(true);
      setTimeout(() => setShowRefreshIndicator(false), 2000);
      
      triggerRefresh();
    }
  }, [refreshToken, open, triggerRefresh]);

  useEffect(() => {
    if (!open) return;
    if (scope === 'branch') {
      setBranchFilter((prev) => {
        if (prev) return prev;
        if (canViewAdmin && branches.length > 0) return String(branches[0].branch_id);
        if (user?.branch_id) return String(user.branch_id);
        return prev;
      });
    } else if (scope === 'user') {
      setBranchFilter('');
    }
  }, [scope, open, canViewAdmin, branches, user]);

  useEffect(() => {
    if (!open) return;
    if (scope === 'branch' && !branchFilter) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchRequests = async () => {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams();
        params.set('scope', scope);
        params.set('limit', '50');
        if ((scope === 'branch' || scope === 'admin') && branchFilter) params.set('branch_id', branchFilter);

        const res = await api.get(`/api/items/request-status?${params.toString()}`, { signal: controller.signal });
        if (!isMounted) return;
        const data = res.data || {};
        // Debug log: show raw response shape for request status fetch
        console.debug('[InventoryRequestMonitorDialog] fetchRequests response:', data);
        const list = Array.isArray(data.requests) ? data.requests : (Array.isArray(data) ? data : []);
        setRequests(list);
        setMeta(data.meta || null);
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch inventory request status feed:', e);
        if (isMounted) { setError('Failed to load request status. Please try again.'); setRequests([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRequests();
    return () => { isMounted = false; controller.abort(); };
  }, [open, scope, branchFilter, refreshIndex]);

  // Ensure BM branch set
  useEffect(() => {
    if (!open || !isBranchManager || scope !== 'branch' || branchFilter) return;
    if (user?.branch_id) setBranchFilter(String(user.branch_id));
  }, [open, isBranchManager, scope, branchFilter, user]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setRequests([]); setMeta(null); setError(null);
      setStatusFilter(''); setRequestTypeFilter(''); setVisibleCount(PAGE_SIZE);
      setCancelDialogOpen(false);
      setCancelDialogContext({ pendingId: null });
      setCancelDialogLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCancelError(null);
      setCancellingId(null);
    }
  }, [open]);

  // Reset paging when inputs change
  useEffect(() => {
    if (!open) return;
    setVisibleCount(PAGE_SIZE);
  }, [open, scope, branchFilter, statusFilter, requestTypeFilter, refreshIndex]);

  // Status chips: show all statuses for everyone (owners can now see cancelled requests too)
  const statusFilterOptions = useMemo(() => {
    return statusFilters;
  }, []);

  // Keep status valid (allow '' or a valid id)
  useEffect(() => {
    if (statusFilter === '' || statusFilterOptions.some((f) => f.id === statusFilter)) return;
    setStatusFilter('');
  }, [statusFilterOptions, statusFilter]);

  // Branch dropdown options
  const branchOptions = useMemo(() => ([
    { value: '', label: 'All Branches' },
    ...branches.map((b) => ({ value: String(b.branch_id), label: b.branch_name }))
  ]), [branches]);

  // Normalize inventory as-is
  const inventoryEntries = useMemo(
    () => (Array.isArray(requests) ? requests.map((r) => ({ kind: 'inventory', ...r })) : []),
    [requests]
  );

  // Normalize userRequests to our unified shape
  const normalizedUserRequests = useMemo(() => {
    if (!Array.isArray(userRequests)) return [];
    return userRequests.map((record) => {
      const rawStatus = String(record?.request_status || record?.status || '').toLowerCase();
      const normalizedStatus = rawStatus === 'active' ? 'approved' : rawStatus;
      if (!['pending', 'approved', 'rejected', 'cancelled'].includes(normalizedStatus)) return null;

      const branchName    = record?.branch || findBranchName(branches, record?.branch_id) || null;
      const createdAtIso  = toISOStringSafe(record?.request_created_at || record?.created_at || record?.createdAt || record?.formated_hire_date || null);
      const approvedAtIso = toISOStringSafe(record?.request_approved_at || record?.approved_at || record?.approvedAt || null);
      const decisionAtIso = toISOStringSafe(record?.request_decision_at || record?.approved_at || record?.approvedAt || record?.updated_at || record?.status_updated_at || null);

      const lastActivityIso = decisionAtIso || approvedAtIso || createdAtIso;
      const roles = normalizeRoleArray(record?.role);
      const creatorName = record?.created_by_display || record?.created_by || 'Branch Manager';
      const creatorIdValue = record?.created_by_id;
      const createdById = (creatorIdValue !== null && creatorIdValue !== undefined && Number.isFinite(Number(creatorIdValue)))
        ? Number(creatorIdValue) : null;
      const creatorNormalized = normalizeComparableString(creatorName);
      const approverName = record?.request_approved_by || record?.approved_by || null;
      const resolutionReason = record?.request_rejection_reason || record?.rejection_reason || record?.resolution_reason || null;

      let statusDetail;
      if (normalizedStatus === 'pending') {
        statusDetail = { code: 'pending', label: 'Pending', tone: 'amber', is_final: false, stage: 'review' };
      } else if (normalizedStatus === 'approved') {
        statusDetail = { code: 'approved', label: 'Approved', tone: 'emerald', is_final: true, stage: 'review' };
      } else if (normalizedStatus === 'cancelled') {
        statusDetail = { code: 'cancelled', label: 'Cancelled', tone: 'slate', is_final: true, stage: 'review' };
      } else if (normalizedStatus === 'deleted') {
        statusDetail = { code: 'deleted', label: 'Deleted', tone: 'slate', is_final: true, stage: 'review' };
      } else {
        statusDetail = { code: 'rejected', label: 'Rejected', tone: 'rose', is_final: true, stage: 'review' };
      }

      const adminTimeline = normalizedStatus === 'pending'
        ? { status: 'pending', acted_at: null, approver_id: null, approver_name: null }
        : {
            status: normalizedStatus === 'approved' ? 'completed' : normalizedStatus,
            acted_at: decisionAtIso,
            approver_id: null,
            approver_name: approverName
          };

      const finalTimeline = normalizedStatus === 'pending'
        ? { status: 'pending', acted_at: null, rejection_reason: null, cancellation_reason: null }
        : {
            status: normalizedStatus,
            acted_at: decisionAtIso,
            rejection_reason: normalizedStatus === 'rejected' ? (resolutionReason || null) : null,
            cancellation_reason: normalizedStatus === 'cancelled' ? (resolutionReason || null) : null
          };

      const safeTimestamp = toTime(createdAtIso) || toTime(decisionAtIso) || Date.now();

      return {
        kind: 'user',
        // Ensure we always produce a stable pending_id even when user_id is missing.
        // Fallback order: user_id -> pending_user_id -> username/email -> createdAt timestamp
        pending_id: `user-${record.user_id ?? record.pending_user_id ?? record.username ?? record.email ?? safeTimestamp}`,
        user_id: record.user_id ?? null,
        branch_id: record.branch_id,
        branch_name: branchName,
        created_by_id: createdById,
        created_by: createdById ?? creatorName,
        created_by_name: creatorName,
        created_by_normalized: creatorNormalized,
        status_detail: statusDetail,
        created_at: createdAtIso,
        last_activity_at: lastActivityIso,
        summary: { action_label: 'User account approval', product_name: record?.full_name || 'New user account', roles },
        timeline: { submitted_at: createdAtIso, manager: null, admin: adminTimeline, final: finalTimeline },
        metadata: { email: record?.username || null, phone: record?.cell_number || null, requested_roles: roles },
        user_status: normalizedStatus,
        normalized_status: normalizedStatus,
        decision_at: decisionAtIso,
        rejection_reason: normalizedStatus === 'rejected' ? resolutionReason : null,
        cancellation_reason: normalizedStatus === 'cancelled' ? resolutionReason : null
      };
    }).filter(Boolean);
  }, [userRequests, branches]);

  const scopedUserRequests = useMemo(() => {
    const parseBranchId = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    if (scope === 'admin') {
      const explicitBranch = parseBranchId(branchFilter);
      if (explicitBranch === null) return normalizedUserRequests;
      return normalizedUserRequests.filter((r) => parseBranchId(r.branch_id) === explicitBranch);
    }

    if (scope === 'branch') {
      const explicitBranch = parseBranchId(branchFilter);
      const fallbackBranch = parseBranchId(user?.branch_id);
      const targetBranch = explicitBranch ?? fallbackBranch;
      if (targetBranch === null) return normalizedUserRequests;
      return normalizedUserRequests.filter((r) => parseBranchId(r.branch_id) === targetBranch);
    }

    if (scope === 'user') {
      const currentUserId = user?.user_id ? Number(user.user_id) : null;
      const comparableName = normalizeComparableString(
        [user?.first_name, user?.last_name].filter(Boolean).join(' ')
        || user?.full_name || user?.name || user?.email || user?.username || ''
      );
      return normalizedUserRequests.filter((r) => {
        if (currentUserId !== null && r.created_by_id !== null && r.created_by_id !== undefined) {
          return Number(r.created_by_id) === currentUserId;
        }
        if (comparableName) return r.created_by_normalized === comparableName;
        return false;
      });
    }

    return normalizedUserRequests;
  }, [normalizedUserRequests, scope, branchFilter, user]);

  const combinedRequests = useMemo(() => {
    const inventory = inventoryEntries;
    const users = scopedUserRequests.map(req => ({ ...req, kind: 'user' }));
    const aggregate = [...inventory, ...users];
    return aggregate.sort((a, b) => toTime(b.last_activity_at || b.created_at) - toTime(a.last_activity_at || a.created_at));
  }, [inventoryEntries, scopedUserRequests]);

  // ✅ ROLE-BASED & chip filtering
  const filteredRequests = useMemo(() => {
    // Simplified, explicit filtering pipeline for clarity and correctness.
    // 1) Start by removing only deleted items (keep cancelled requests)
    let list = combinedRequests.filter((req) => {
      const code = req?.status_detail?.code;
      if (!code) return false;
      if (code === 'deleted') return false; // Only filter out deleted, keep cancelled
      return true;
    });

    // 2) Role-based visibility constraints
    list = list.filter((req) => {
      const code = req.status_detail?.code;
      if (!code) return false;

      // Owner: show only final decisions (approved/rejected/cancelled) to avoid clutter
      // BUT allow pending requests when explicitly viewing "pending" status
      if (isOwnerUser && statusFilter !== 'pending') {
        if (req.kind === 'user') return ['approved', 'rejected', 'cancelled'].includes(req.normalized_status);
        return ['approved', 'rejected', 'cancelled'].includes(code);
      }

      // Branch Manager: if not explicitly viewing pending, hide items that are "pending_manager"
      if (isBranchManager && statusFilter !== 'pending') {
        return code !== 'pending_manager';
      }

      return true;
    });

    // 3) Type filter (strict): if a type chip is active, only show that kind
    if (requestTypeFilter) {
      list = list.filter((req) => req.kind === requestTypeFilter);
    }

    // 4) Status filter: explicit, small set of rules to avoid leakage of rejected/cancelled user accounts
    if (!statusFilter) {
      // Default behavior:
      // - If the user explicitly selected the "User" type chip, show all user requests
      //   (include rejected/cancelled) so branch managers/owners can review as many accounts as possible.
      // - Otherwise, hide rejected/cancelled user accounts unless 'rejected'/'cancelled' is explicitly selected.
      if (requestTypeFilter === 'user') {
        return list;
      }

      list = list.filter((req) => !(req.kind === 'user' && (req.normalized_status === 'rejected' || req.normalized_status === 'cancelled')));
      return list;
    }

    if (statusFilter === 'pending') {
      return list.filter((req) => {
        if (req.kind === 'user') return req.normalized_status === 'pending';
        const code = req.status_detail?.code || '';
        return code === 'pending' || code === 'pending_manager' || code === 'pending_admin';
      });
    }

    if (statusFilter === 'changes_requested') {
      return list.filter((req) => {
        // only inventory requests can be changes_requested
        if (req.kind !== 'inventory') return false;
        return req.status_detail?.code === 'changes_requested';
      });
    }

    if (statusFilter === 'rejected') {
      return list.filter((req) => {
        if (requestTypeFilter === 'user') return req.kind === 'user' && req.normalized_status === 'rejected';
        if (requestTypeFilter === 'inventory') return req.kind === 'inventory' && req.status_detail?.code === 'rejected';
        // No type specified: include both rejected inventory and user requests
        return (req.kind === 'inventory' && req.status_detail?.code === 'rejected') || (req.kind === 'user' && req.normalized_status === 'rejected');
      });
    }

    if (statusFilter === 'cancelled') {
      return list.filter((req) => {
        if (requestTypeFilter === 'user') return req.kind === 'user' && req.normalized_status === 'cancelled';
        if (requestTypeFilter === 'inventory') return req.kind === 'inventory' && req.status_detail?.code === 'cancelled';
        // No type specified: include both cancelled inventory and user requests
        return (req.kind === 'inventory' && req.status_detail?.code === 'cancelled') || (req.kind === 'user' && req.normalized_status === 'cancelled');
      });
    }

    // Other explicit status chips (e.g., 'approved')
    return list.filter((req) => {
      if (req.kind === 'user') return req.normalized_status === statusFilter;
      return req.status_detail?.code === statusFilter;
    });
  }, [
    combinedRequests,
    isOwnerUser,
    isBranchManager,
    canSeeTypeFilter,
    requestTypeFilter,
    statusFilter
  ]);

  const visibleRequests = useMemo(() => {
    if (filteredRequests.length === 0) return filteredRequests;
    const limit = Math.min(visibleCount, filteredRequests.length);
    return filteredRequests.slice(0, limit);
  }, [filteredRequests, visibleCount]);

  const hasMore = visibleCount < filteredRequests.length;

  const handleScroll = (e) => {
    if (!hasMore) return;
    const t = e.currentTarget; if (!t) return;
    const { scrollTop, clientHeight, scrollHeight } = t;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      setVisibleCount((prev) => (prev >= filteredRequests.length ? prev : Math.min(prev + PAGE_SIZE, filteredRequests.length)));
    }
  };

  const combinedLoading = loading || userRequestsLoading;

  const handleCancelInventory = useCallback(async (pendingId) => {
    if (typeof onCancelInventoryRequest !== 'function') {
      return;
    }

    setCancelDialogContext({ pendingId });
    setCancelDialogOpen(true);
  }, [onCancelInventoryRequest]);

  const handleCancelUserRequest = useCallback(async (pendingUserId) => {
    if (typeof onCancelUserRequest !== 'function') {
      return;
    }

    let confirmed = true;

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      confirmed = window.confirm('Cancel this user request? This action cannot be undone.');
    }

    if (!confirmed) {
      return;
    }

    try {
      setCancelError(null);
      const identifier = `user-${pendingUserId}`;
      setCancellingId(identifier);
      await onCancelUserRequest(pendingUserId);
      triggerRefresh();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to cancel the request. Please try again.';
      setCancelError(message);
    } finally {
      setCancellingId(null);
    }
  }, [onCancelUserRequest, triggerRefresh]);

  const handleCancelDialogCancel = useCallback(() => {
    if (cancelDialogLoading) return;
    setCancelDialogOpen(false);
    setCancelDialogContext({ pendingId: null });
  }, [cancelDialogLoading]);

  const handleCancelDialogConfirm = useCallback(async (reason) => {
    if (cancelDialogContext.pendingId === null) {
      handleCancelDialogCancel();
      return;
    }

    const pendingId = cancelDialogContext.pendingId;
    setCancelDialogLoading(true);

    try {
      setCancelError(null);
      const identifier = `inventory-${pendingId}`;
      setCancellingId(identifier);
      await onCancelInventoryRequest(pendingId, reason);
      triggerRefresh();
      handleCancelDialogCancel();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to cancel the request. Please try again.';
      setCancelError(message);
    } finally {
      setCancellingId(null);
      setCancelDialogLoading(false);
    }
  }, [cancelDialogContext.pendingId, onCancelInventoryRequest, triggerRefresh, handleCancelDialogCancel]);

  const handleRequestChangeOpen = useCallback((pendingId) => {
    setChangeDialogContext({ pendingId, changeType: 'quantity', comment: '' });
    setChangeDialogOpen(true);
  }, []);

  const handleRequestChangeCancel = useCallback(() => {
    if (changeDialogLoading) return;
    setChangeDialogOpen(false);
    setChangeDialogContext({ pendingId: null, changeType: 'quantity', comment: '' });
  }, [changeDialogLoading]);

  const handleRequestChangeSubmit = useCallback(async () => {
    if (!changeDialogContext.pendingId) return handleRequestChangeCancel();
    try {
      setChangeDialogLoading(true);
      // Delegate API call to parent via onRequestChanges prop if available
      if (typeof onRequestChanges === 'function') {
        const { pendingId, changeType, comment } = changeDialogContext;
        await onRequestChanges(pendingId, changeType, comment);
      } else {
        console.warn('onRequestChanges handler not provided');
      }
    } catch (e) {
      console.error('Failed to request changes:', e);
    } finally {
      setChangeDialogLoading(false);
      // Close dialog and refresh
      setChangeDialogOpen(false);
      setChangeDialogContext({ pendingId: null, changeType: 'quantity', comment: '' });
      triggerRefresh();
    }
  }, [changeDialogContext, triggerRefresh, changeDialogLoading, handleRequestChangeCancel]);

  const openHistoryModal = useCallback((pendingId) => {
    setSelectedHistoryPendingId(pendingId);
    setHistoryModalOpen(true);
  }, []);

  const closeHistoryModal = useCallback(() => {
    setSelectedHistoryPendingId(null);
    setHistoryModalOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={cancelDialogOpen ? undefined : onClose}
    >
      <div
        className="relative flex h-[90vh] w-full max-w-4xl mx-2 lg:mx-4 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header: overflow-visible so dropdown menus aren't clipped on mobile */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-white px-4 sm:px-6 py-4 overflow-visible">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Request Status</h2>
              <p className="text-sm text-gray-500">Review user accounts and inventory requests that need action.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Refresh"
                title="Refresh"
                onClick={triggerRefresh}
                disabled={loading}
              >
                <MdRefresh className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
                onClick={onClose}
                aria-label="Close request status dialog"
              >
                <IoMdClose className='w-5 h-5 sm:w-6 sm:h-6' />
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {/* Branch filter — Owner/Admin only; full width on mobile, high z-index */}
            {canViewAdmin && (
              <div className="order-1 col-span-full sm:col-span-1 rounded-xl border border-gray-200 bg-gray-50 p-3 z-30">
                <DropdownCustom
                  label="Branch"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  options={branchOptions}
                  variant="default"
                  size="md"
                />
              </div>
            )}

            {/* Status chips (Pending removed for Owner via statusFilterOptions) */}
            <div className="order-2 rounded-xl border border-gray-200 bg-gray-50 p-3 xl:col-span-2">
              <span className="text-xs font-semibold uppercase text-gray-500">Status</span>
              <div className="mt-2 flex items-center gap-2 flex-nowrap overflow-x-auto">
                {statusFilterOptions.map((filter) => {
                  const isActive = statusFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        isActive
                          ? 'bg-green-100 text-green-700 ring-1 ring-green-600/40'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      onClick={() => setStatusFilter(isActive ? '' : filter.id)}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type chips — BM & Owner only; ALWAYS enabled */}
            {canSeeTypeFilter && (
              <div className="order-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <span className="text-xs font-semibold uppercase text-gray-500">Type</span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {requestTypeFilters.map((filter) => {
                    const isActive = requestTypeFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/50'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        onClick={() => setRequestTypeFilter(isActive ? '' : filter.id)}
                      >
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {cancelError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {cancelError}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4" onScroll={handleScroll}>
          {combinedLoading ? (
            <div className="py-12"><ChartLoading message="Loading request history..." /></div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-sm text-gray-500">
              <p>No requests match this filter yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleRequests.map((request) => {
                const tone = request.status_detail?.tone || 'slate';
                const toneClass = toneStyles[tone] || toneStyles.slate;

                if (request.kind === 'user') {
                  const rolesLabel = Array.isArray(request.summary?.roles) ? request.summary.roles.join(', ') : '';
                  const branchName = request.branch_name || findBranchName(branches, request.branch_id) || '—';
                  const requestedBy = request.created_by_name || 'Branch Manager';
                  const submittedAt = formatDateTime(request.created_at);
                  const email = request.metadata?.email || '—';
                  const phone = request.metadata?.phone || '—';
                  const userStatus = request.user_status || 'pending';
                  const decisionAt = request.decision_at;
                  const ownerStageDescription = (() => {
                      if (userStatus === 'approved') return `Approved${decisionAt ? ` on ${formatDateTime(decisionAt)}` : ''}`;
                      if (userStatus === 'rejected') return `Rejected${decisionAt ? ` on ${formatDateTime(decisionAt)}` : ''}`;
                      if (userStatus === 'cancelled') return `Cancelled${decisionAt ? ` on ${formatDateTime(decisionAt)}` : ''}`;
                    return 'Pending';
                  })();
                  const cancellationReason = request.cancellation_reason;
                  const rejectionReason = request.rejection_reason;
                  const resolutionReason = userStatus === 'cancelled' ? cancellationReason : rejectionReason;
                  const reasonLabel = userStatus === 'cancelled' ? 'Cancellation reason' : 'Reason';
                  const reasonToneClass = userStatus === 'cancelled' ? 'text-slate-600' : 'text-rose-600';
                  const canCancelUser = typeof onCancelUserRequest === 'function'
                    && currentUserId !== null
                    && Number.isFinite(Number(request.created_by_id ?? request.created_by))
                    && Number(request.created_by_id ?? request.created_by) === currentUserId
                    && request.status_detail
                    && !request.status_detail.is_final;
                  const cancelKey = request.pending_id;
                  const isCancellingUser = cancellingId === cancelKey;
                  const borderToneClass = (() => {
                    switch (request.status_detail?.tone) {
                      case 'emerald': return 'border-emerald-200';
                      case 'rose':    return 'border-rose-200';
                      case 'blue':    return 'border-blue-200';
                      default:        return 'border-amber-200';
                    }
                  })();

                  return (
                    <div
                      key={request.pending_id}
                      className={`rounded-xl border-2 ${borderToneClass} bg-white p-5 shadow-sm transition hover:shadow-md`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">User Account</p>
                          <h3 className="text-lg font-semibold text-gray-800">
                            {request.summary?.product_name || 'User account'}
                          </h3>
                          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                            <span>Branch: <span className="font-medium text-gray-700">{branchName}</span></span>
                            <span>Submitted: <span className="font-medium text-gray-700">{submittedAt}</span></span>
                            <span>Requested by: <span className="font-medium text-gray-700">{requestedBy}</span></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-2 rounded-full  border px-3 py-1 text-sm font-semibold whitespace-nowrap ${toneClass.badge}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`} />
                            {request.status_detail?.label || 'Pending'}
                          </span>
                          {canCancelUser && (
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => handleCancelUserRequest(request.user_id ?? String(request.pending_id).replace(/^user-/, ''))}
                              disabled={isCancellingUser}
                            >
                              {isCancellingUser ? 'Cancelling…' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-xs font-semibold uppercase text-gray-500">Roles</p>
                          <p className="text-sm font-medium text-gray-800">{rolesLabel || '—'}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-xs font-semibold uppercase text-gray-500">Login Email</p>
                          <p className="text-sm font-medium text-gray-800">{email}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-xs font-semibold uppercase text-gray-500">Mobile Number</p>
                          <p className="text-sm font-medium text-gray-800">{phone}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase text-gray-500">Owner Stage</p>
                        <p className="text-sm text-gray-700">{ownerStageDescription}</p>
                        {userStatus !== 'pending' && resolutionReason && (
                          <p className={`mt-2 text-sm ${reasonToneClass}`}>{reasonLabel}: {resolutionReason}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                const manager = request.timeline?.manager || {};
                const admin   = request.timeline?.admin || null;
                const final   = request.timeline?.final || {};
                const summary = request.summary || {};
                const statusLabel = request.status_detail?.label || request.status;
                const branchName = request.branch_name || findBranchName(branches, request.branch_id) || 'N/A';
                const creatorIdRaw = request.created_by ?? null;
                const creatorId = creatorIdRaw === null ? NaN : Number(creatorIdRaw);
                const canCancelInventory = typeof onCancelInventoryRequest === 'function'
                  && currentUserId !== null
                  && Number.isFinite(creatorId)
                  && creatorId === currentUserId
                  && !request.cancelled_at
                  && request.status_detail
                  && !request.status_detail.is_final;
                const inventoryCancelKey = `inventory-${request.pending_id}`;
                const isCancelling = cancellingId === inventoryCancelKey;

                const managerDescription =
                  manager.status === 'completed'
                    ? `Approved by ${manager.approver_name || 'Branch Manager'} on ${formatDateTime(manager.acted_at)}`
                    : 'Awaiting branch manager decision';

                const adminDescription = !request.requires_admin_review
                  ? 'Owner confirmation not required'
                  : admin?.status === 'completed'
                    ? `Approved by ${admin.approver_name || 'Owner'} on ${formatDateTime(admin.acted_at)}`
                    : 'Awaiting owner decision';

                const finalDescription =
                  final.status === 'approved'
                    ? `Completed on ${formatDateTime(final.acted_at)}`
                    : final.status === 'rejected'
                      ? `Rejected on ${formatDateTime(final.acted_at)}`
                      : final.status === 'cancelled'
                        ? `Cancelled on ${formatDateTime(final.acted_at)}`
                        : 'In progress';

                return (
                  <div key={request.pending_id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                      onClick={() => {
                      // If the current user is the requester and the request has changes requested, open edit modal
                      if (currentUserId !== null && request.created_by && Number(currentUserId) === Number(request.created_by) && request.status_detail?.code === 'changes_requested') {
                        if (typeof onOpenEditRequest === 'function') {
                          const changeType = request.change_request_type || request.payload?.change_request_type || 'quantity';
                          onOpenEditRequest({ pendingId: request.pending_id, changeType });
                        }
                      }
                    }}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {summary.action_label || 'Inventory Request'}
                        </p>
                        <h3 className="text-lg font-semibold text-gray-800">{summary.product_name || 'Inventory item'}</h3>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                          <span>Branch: <span className="font-medium text-gray-700">{branchName}</span></span>
                          <span>Submitted: <span className="font-medium text-gray-700">{formatDateTime(request.created_at)}</span></span>
                          <span>Requested by: <span className="font-medium text-gray-700">{request.created_by_name || 'Unknown user'}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold whitespace-nowrap ${toneClass.badge}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`} />
                          {statusLabel}
                        </span>
                          {canCancelInventory && (
                          <button
                            type="button"
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleCancelInventory(request.pending_id)}
                            disabled={isCancelling}
                          >
                            {isCancelling ? 'Cancelling…' : 'Cancel'}
                          </button>
                          )}
                          {/* Manager/Owner: Request Changes button */}
                          {(isBranchManager || isOwnerUser) && (request.status_detail?.code === 'pending' || request.status_detail?.code === 'pending_manager' || request.status_detail?.code === 'pending_admin') && (
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => { console.log('Request changes clicked for', request.pending_id); handleRequestChangeOpen(request.pending_id); }}
                            >
                              Request changes
                            </button>
                          )}
                          {/* Creator: Make changes button for requests with changes_requested */}
                          {currentUserId !== null && request.created_by && Number(currentUserId) === Number(request.created_by) && request.status_detail?.code === 'changes_requested' && (
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                              onClick={() => {
                                // Ask parent to open appropriate edit modal based on change_request_type, passing the pending id
                                const changeType = (request.payload?.change_request_type || request.change_request_type || request.payload?.change_type || null);
                                console.log('Make changes clicked: pendingId=', request.pending_id, 'changeType=', changeType);
                                if (typeof onOpenEditRequest === 'function') {
                                  onOpenEditRequest({ pendingId: request.pending_id, changeType });
                                }
                              }}
                            >
                              Make changes
                            </button>
                          )}
                          {/* View History button for all inventory requests */}
                          <button
                            type="button"
                            className="rounded-md border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              openHistoryModal(request.pending_id);
                            }}
                          >
                            View History
                          </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Quantity Requested</p>
                        <p className="text-sm font-medium text-gray-800">
                          {summary.quantity_requested !== null && summary.quantity_requested !== undefined
                            ? `${formatNumber(summary.quantity_requested)} ${summary.unit || ''}`.trim()
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Current Quantity</p>
                        <p className="text-sm font-medium text-gray-800">
                          {summary.current_quantity !== null && summary.current_quantity !== undefined
                            ? `${formatNumber(summary.current_quantity)} ${summary.unit || ''}`.trim()
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Unit Price</p>
                        <p className="text-sm font-medium text-gray-800">{formatCurrencyValue(summary.unit_price)}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Unit Cost</p>
                        <p className="text-sm font-medium text-gray-800">{formatCurrencyValue(summary.unit_cost)}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase text-gray-500">Branch Manager Stage</p>
                        <p className="text-sm text-gray-700">{managerDescription}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase text-gray-500">Owner Stage</p>
                        <p className="text-sm text-gray-700">{adminDescription}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Overall Status</p>
                        <p className="text-sm text-gray-700">{finalDescription}</p>
                      </div>
                    </div>

                    {final.status === 'rejected' && request.rejection_reason && (
                      <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                        <p className="font-semibold">Rejection Reason</p>
                        <p>{request.rejection_reason}</p>
                      </div>
                    )}

                    {final.status === 'cancelled' && request.cancelled_reason && (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <p className="font-semibold">Cancellation Reason</p>
                        <p>{request.cancelled_reason}</p>
                      </div>
                    )}

                    {request.status_detail?.code === 'changes_requested' && (request.change_request_comment || request.payload?.change_request_comment) && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                        <p className="font-semibold">Changes Requested</p>
                        <p>{request.change_request_comment || request.payload?.change_request_comment}</p>
                        {(request.change_request_type || request.payload?.change_request_type) && (
                          <p className="mt-2 text-xs text-amber-700">Requested change: <span className="font-medium">{(request.change_request_type || request.payload?.change_request_type)}</span></p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore ? (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <button
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                    onClick={() => setVisibleCount((prev) => (prev >= filteredRequests.length ? prev : Math.min(prev + PAGE_SIZE, filteredRequests.length)))}
                  >
                    Load more
                  </button>
                  <p className="text-xs text-gray-400">Showing {visibleRequests.length} of {filteredRequests.length} requests</p>
                </div>
              ) : (
                <p className="text-center text-xs text-gray-400">
                  Showing all {visibleRequests.length} request{visibleRequests.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Reason Dialog */}
      <CancellationReasonDialog
        open={cancelDialogOpen}
        onCancel={handleCancelDialogCancel}
        onConfirm={handleCancelDialogConfirm}
        loading={cancelDialogLoading}
      />
      {/* Change Request Dialog */}
      {changeDialogOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={() => changeDialogLoading ? null : handleRequestChangeCancel()}>
          <div className="relative w-[min(680px,95%)] rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800">Request Changes</h3>
            <p className="text-sm text-gray-500 mt-1">Ask the requester to make changes to their pending request.</p>
            <div className="mt-4">
              <label className="text-xs text-gray-600">Change type</label>
              <select
                value={changeDialogContext.changeType}
                onChange={(e) => setChangeDialogContext(c => ({ ...c, changeType: e.target.value }))}
                className="mt-1 w-full rounded border p-2"
              >
                <option value="quantity">Quantity</option>
                <option value="product_info">Product information</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mt-4">
              <label className="text-xs text-gray-600">Comment</label>
              <textarea
                value={changeDialogContext.comment}
                onChange={(e) => setChangeDialogContext(c => ({ ...c, comment: e.target.value }))}
                className="mt-1 w-full rounded border p-2 h-28"
                placeholder="Tell the user what's required (e.g., update quantity, fix product name)">
              </textarea>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border px-4 py-2 text-sm" onClick={handleRequestChangeCancel} disabled={changeDialogLoading}>Cancel</button>
              <button
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white"
                onClick={handleRequestChangeSubmit}
                disabled={changeDialogLoading}
              >{changeDialogLoading ? 'Sending…' : 'Send change request'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Inventory Request History Modal */}
      <InventoryRequestHistoryModal
        open={historyModalOpen}
        onClose={closeHistoryModal}
        pendingId={selectedHistoryPendingId}
        formatDateTime={formatDateTime}
      />
    </div>
  );
};

export default InventoryRequestMonitorDialog;
