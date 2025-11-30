import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { computeApprovalLabel } from '../../utils/approvalLabels';
import api from '../../utils/api';
import { currencyFormat } from '../../utils/formatCurrency.js';
import ChartLoading from '../common/ChartLoading.jsx';
import DropdownCustom from '../DropdownCustom';
import { IoMdClose } from 'react-icons/io';
import { MdRefresh, MdHistory } from 'react-icons/md';
import useModalLock from '../../hooks/useModalLock';
import CancellationReasonDialog from './CancellationReasonDialog';
import InventoryRequestHistoryModal from '../InventoryRequestHistoryModal';

const toneStyles = {
  slate: {
    badge: 'border-slate-200 bg-slate-50 text-slate-700',
    dot: 'bg-slate-500',
  },
  emerald: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  rose: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
  },
  amber: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  blue: {
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
  },
};

// Removed "Requires changes" tab – those requests are now under Pending
const statusFilters = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
];

const requestTypeFilters = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'user', label: 'User Accounts' },
];

const PAGE_SIZE = 12;

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatNumber = (v) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? '—'
    : numberFormatter.format(Number(v));

const formatCurrencyValue = (v) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? 'N/A'
    : currencyFormat(Number(v));

const formatDateTime = (v) => {
  const d = new Date(v || '');
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d);
};
const toISOStringSafe = (v) => {
  const d = new Date(v || '');
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const toTime = (v) => {
  const d = new Date(v || '');
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const normalizeRoleArray = (roles) => {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles.filter(Boolean);
  if (typeof roles === 'string')
    return roles
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
  return [];
};
const normalizeComparableString = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const findBranchName = (branches, branchId) => {
  if (!branchId) return null;
  const numeric = Number(branchId);
  return (
    branches.find((b) => Number(b.branch_id) === numeric)?.branch_name || null
  );
};

// Helper to force "For approval" label where needed
const resolveStatusPillLabel = (request, { isOwnerUser, isBranchManager }) => {
  const base = computeApprovalLabel(request, {
    isOwner: isOwnerUser,
    isBranchManager,
  });

  if (isOwnerUser) {
    if (request.kind === 'inventory' && request.status_detail?.code === 'pending_admin') {
      return 'For Approval';
    }
    if (request.kind === 'user' && request.normalized_status === 'pending') {
      return 'For Approval';
    }
  }

  return base;
};

const InventoryRequestMonitorDialog = ({
  open,
  onClose,
  user,
  branches = [],
  userRequests = [],
  userRequestsLoading = false,
  refreshToken = 0,
  onRefresh = null,
  onCancelInventoryRequest,
  onCancelUserRequest,
  onOpenEditRequest,
}) => {
  useModalLock(open, onClose);

  const roleList = useMemo(() => {
    if (!user || !user.role) return [];
    return Array.isArray(user.role) ? user.role : [user.role];
  }, [user]);

  const isOwnerUser = roleList.includes('Owner');
  const isBranchManager = roleList.includes('Branch Manager');
  const canViewAdmin = isOwnerUser;
  const canSeeTypeFilter = isBranchManager || isOwnerUser;

  const currentUserId = useMemo(() => {
    const candidate = Number(user?.user_id);
    return Number.isFinite(candidate) ? candidate : null;
  }, [user]);

  const defaultScope = useMemo(
    () => (isOwnerUser ? 'admin' : isBranchManager ? 'branch' : 'user'),
    [isOwnerUser, isBranchManager]
  );
  const [scope, setScope] = useState(defaultScope);

  const [branchFilter, setBranchFilter] = useState(() => {
    if (defaultScope === 'branch') {
      if (canViewAdmin && branches.length > 0)
        return String(branches[0].branch_id);
      if (user?.branch_id) return String(user.branch_id);
    }
    return '';
  });

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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelDialogContext, setCancelDialogContext] = useState({
    pendingId: null,
  });
  const [cancelDialogLoading, setCancelDialogLoading] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryPendingId, setSelectedHistoryPendingId] =
    useState(null);

  // NEW: track which "Make changes" button is in loading state
  const [editingPendingId, setEditingPendingId] = useState(null); // NEW

  const triggerRefresh = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!open) return;
    setBranchFilter('');
    if (isOwnerUser || isBranchManager) {
      setStatusFilter('pending');
      setRequestTypeFilter('inventory');
    } else {
      setStatusFilter('pending');
    }
  }, [open, isOwnerUser, isBranchManager]);

  useEffect(() => {
    if (!open) {
      setVisibleCount(PAGE_SIZE);
      return;
    }
    setScope((prev) => (prev === defaultScope ? prev : defaultScope));
  }, [defaultScope, open]);

  useEffect(() => {
    if (!open) {
      lastRefreshTokenRef.current = refreshToken;
      return;
    }
    if (refreshToken === undefined || refreshToken === null) return;

    if (lastRefreshTokenRef.current !== refreshToken) {
      lastRefreshTokenRef.current = refreshToken;
      console.log(
        '🔄 WebSocket event detected - refreshing inventory request status'
      );
      triggerRefresh();
      if (typeof onRefresh === 'function') onRefresh();
    }
  }, [refreshToken, open, triggerRefresh, onRefresh]);

  useEffect(() => {
    if (!open) return;
    if (scope === 'branch') {
      setBranchFilter((prev) => {
        if (prev) return prev;
        if (canViewAdmin && branches.length > 0)
          return String(branches[0].branch_id);
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
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('scope', scope);
        params.set('limit', '50');
        if ((scope === 'branch' || scope === 'admin') && branchFilter)
          params.set('branch_id', branchFilter);

        const res = await api.get(
          `/api/items/request-status?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!isMounted) return;
        const data = res.data || {};
        console.debug(
          '[InventoryRequestMonitorDialog] fetchRequests response:',
          data
        );
        const list = Array.isArray(data.requests)
          ? data.requests
          : Array.isArray(data)
          ? data
          : [];
        setRequests(list);
        setMeta(data.meta || null);
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch inventory request status feed:', e);
        if (isMounted) {
          setError('Failed to load request status. Please try again.');
          setRequests([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRequests();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [open, scope, branchFilter, refreshIndex]);

  useEffect(() => {
    if (!open || !isBranchManager || scope !== 'branch' || branchFilter)
      return;
    if (user?.branch_id) setBranchFilter(String(user.branch_id));
  }, [open, isBranchManager, scope, branchFilter, user]);

  useEffect(() => {
    if (!open) {
      setRequests([]);
      setMeta(null);
      setError(null);
      setStatusFilter('');
      setRequestTypeFilter('');
      setVisibleCount(PAGE_SIZE);
      setCancelDialogOpen(false);
      setCancelDialogContext({ pendingId: null });
      setCancelDialogLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCancelError(null);
      setCancellingId(null);
      setEditingPendingId(null); // NEW: reset loading state when dialog closes
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setVisibleCount(PAGE_SIZE);
  }, [open, scope, branchFilter, statusFilter, requestTypeFilter, refreshIndex]);

  const statusFilterOptions = useMemo(() => statusFilters, []);

  useEffect(() => {
    if (
      statusFilter === '' ||
      statusFilterOptions.some((f) => f.id === statusFilter)
    )
      return;
    setStatusFilter('');
  }, [statusFilterOptions, statusFilter]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: 'All Branches' },
      ...branches.map((b) => ({
        value: String(b.branch_id),
        label: b.branch_name,
      })),
    ],
    [branches]
  );

  const inventoryEntries = useMemo(
    () =>
      Array.isArray(requests)
        ? requests.map((r) => ({ kind: 'inventory', ...r }))
        : [],
    [requests]
  );

  const normalizedUserRequests = useMemo(() => {
    if (!Array.isArray(userRequests)) return [];
    return userRequests
      .map((record) => {
        const rawStatus = String(
          record?.request_status || record?.status || ''
        ).toLowerCase();
        const normalizedStatus = (() => {
          if (rawStatus === 'active') return 'approved';
          if (rawStatus === 'deleted') return 'cancelled';
          return rawStatus;
        })();
        if (
          !['pending', 'approved', 'rejected', 'cancelled'].includes(
            normalizedStatus
          )
        )
          return null;

        const branchName =
          record?.branch ||
          findBranchName(branches, record?.branch_id) ||
          null;
        const createdAtIso = toISOStringSafe(
          record?.request_created_at ||
            record?.created_at ||
            record?.createdAt ||
            record?.formated_hire_date ||
            null
        );
        const approvedAtIso = toISOStringSafe(
          record?.request_approved_at ||
            record?.approved_at ||
            record?.approvedAt ||
            null
        );
        const decisionAtIso = toISOStringSafe(
          record?.request_decision_at ||
            record?.approved_at ||
            record?.approvedAt ||
            record?.updated_at ||
            record?.status_updated_at ||
            null
        );

        const lastActivityIso = decisionAtIso || approvedAtIso || createdAtIso;
        const roles = normalizeRoleArray(record?.role);
        const creatorName =
          record?.created_by_display ||
          record?.created_by ||
          'Branch Manager';
        const creatorIdValue = record?.created_by_id;
        const createdById =
          creatorIdValue !== null &&
          creatorIdValue !== undefined &&
          Number.isFinite(Number(creatorIdValue))
            ? Number(creatorIdValue)
            : null;
        const creatorNormalized = normalizeComparableString(creatorName);
        const approverName =
          record?.request_approved_by || record?.approved_by || null;
        const resolutionReason =
          record?.request_rejection_reason ||
          record?.rejection_reason ||
          record?.resolution_reason ||
          null;

        let statusDetail;
        if (normalizedStatus === 'pending') {
          statusDetail = {
            code: 'pending',
            label: 'Pending',
            tone: 'amber',
            is_final: false,
            stage: 'review',
          };
        } else if (normalizedStatus === 'approved') {
          statusDetail = {
            code: 'approved',
            label: 'Approved',
            tone: 'emerald',
            is_final: true,
            stage: 'review',
          };
        } else if (normalizedStatus === 'cancelled') {
          statusDetail = {
            code: 'cancelled',
            label: 'Cancelled',
            tone: 'slate',
            is_final: true,
            stage: 'review',
          };
        } else if (normalizedStatus === 'deleted') {
          statusDetail = {
            code: 'deleted',
            label: 'Deleted',
            tone: 'slate',
            is_final: true,
            stage: 'review',
          };
        } else {
          statusDetail = {
            code: 'rejected',
            label: 'Rejected',
            tone: 'rose',
            is_final: true,
            stage: 'review',
          };
        }

        const adminTimeline =
          normalizedStatus === 'pending'
            ? {
                status: 'pending',
                acted_at: null,
                approver_id: null,
                approver_name: null,
              }
            : {
                status:
                  normalizedStatus === 'approved'
                    ? 'completed'
                    : normalizedStatus,
                acted_at: decisionAtIso,
                approver_id: null,
                approver_name: approverName,
              };

        const finalTimeline =
          normalizedStatus === 'pending'
            ? {
                status: 'pending',
                acted_at: null,
                rejection_reason: null,
                cancellation_reason: null,
              }
            : {
                status: normalizedStatus,
                acted_at: decisionAtIso,
                rejection_reason:
                  normalizedStatus === 'rejected'
                    ? resolutionReason || null
                    : null,
                cancellation_reason:
                  normalizedStatus === 'cancelled'
                    ? resolutionReason || null
                    : null,
              };

        const safeTimestamp =
          toTime(createdAtIso) || toTime(decisionAtIso) || Date.now();

        const basePendingKey = `user-${
          record.user_id ??
          record.pending_user_id ??
          record.username ??
          record.email ??
          safeTimestamp
        }`;
        let uniquePendingKey = basePendingKey;
        if (
          normalizedStatus === 'rejected' ||
          normalizedStatus === 'cancelled'
        ) {
          const suffix =
            decisionAtIso ||
            record?.request_resolved_at ||
            record?.resolved_at ||
            createdAtIso ||
            safeTimestamp;
          uniquePendingKey = `${basePendingKey}__${normalizedStatus}__${suffix}`;
        }

        return {
          kind: 'user',
          pending_id: uniquePendingKey,
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
          summary: {
            action_label: 'User account approval',
            product_name: record?.full_name || 'New user account',
            roles,
          },
          timeline: {
            submitted_at: createdAtIso,
            manager: null,
            admin: adminTimeline,
            final: finalTimeline,
          },
          metadata: {
            email: record?.username || null,
            phone: record?.cell_number || null,
            requested_roles: roles,
          },
          user_status: normalizedStatus,
          normalized_status: normalizedStatus,
          decision_at: decisionAtIso,
          rejection_reason:
            normalizedStatus === 'rejected' ? resolutionReason : null,
          cancellation_reason:
            normalizedStatus === 'cancelled' ? resolutionReason : null,
          cancelled_by_id:
            record?.deleted_by_user_id ?? record?.deleted_by_admin_id ?? null,
        };
      })
      .filter(Boolean);
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
      return normalizedUserRequests.filter(
        (r) => parseBranchId(r.branch_id) === explicitBranch
      );
    }

    if (scope === 'branch') {
      const explicitBranch = parseBranchId(branchFilter);
      const fallbackBranch = parseBranchId(user?.branch_id);
      const targetBranch = explicitBranch ?? fallbackBranch;
      if (targetBranch === null) return normalizedUserRequests;
      return normalizedUserRequests.filter(
        (r) => parseBranchId(r.branch_id) === targetBranch
      );
    }

    if (scope === 'user') {
      const currentUserIdNum = user?.user_id ? Number(user.user_id) : null;
      const comparableName = normalizeComparableString(
        [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
          user?.full_name ||
          user?.name ||
          user?.email ||
          user?.username ||
          ''
      );
      return normalizedUserRequests.filter((r) => {
        if (
          currentUserIdNum !== null &&
          r.created_by_id !== null &&
          r.created_by_id !== undefined
        ) {
          return Number(r.created_by_id) === currentUserIdNum;
        }
        if (comparableName) return r.created_by_normalized === comparableName;
        return false;
      });
    }

    return normalizedUserRequests;
  }, [normalizedUserRequests, scope, branchFilter, user]);

  const combinedRequests = useMemo(() => {
    const inventory = inventoryEntries;
    const users = scopedUserRequests.map((req) => ({
      ...req,
      kind: 'user',
    }));
    const aggregate = [...inventory, ...users];

    const ownerNeedsAction = (req) => {
      if (!isOwnerUser) return false;
      if (req.kind === 'inventory') {
        return req.status_detail?.code === 'pending_admin';
      }
      if (req.kind === 'user') {
        return req.normalized_status === 'pending';
      }
      return false;
    };

    return aggregate.sort((a, b) => {
      const aOwner = ownerNeedsAction(a);
      const bOwner = ownerNeedsAction(b);

      if (aOwner !== bOwner) {
        // Items needing owner approval go on top
        return aOwner ? -1 : 1;
      }

      return (
        toTime(b.last_activity_at || b.created_at) -
        toTime(a.last_activity_at || a.created_at)
      );
    });
  }, [inventoryEntries, scopedUserRequests, isOwnerUser]);

  const filteredRequests = useMemo(() => {
    let list = combinedRequests.filter((req) => {
      const code = req?.status_detail?.code;
      if (!code) return false;
      if (code === 'deleted') return false;
      return true;
    });

    list = list.filter((req) => {
      const code = req.status_detail?.code;
      if (!code) return false;

      if (isOwnerUser && statusFilter !== 'pending') {
        if (req.kind === 'user')
          return ['approved', 'rejected'].includes(req.normalized_status);
        return ['approved', 'rejected', 'cancelled', 'changes_requested'].includes(
          code
        );
      }

      if (isBranchManager && statusFilter !== 'pending') {
        return code !== 'pending_manager';
      }

      return true;
    });

    if (requestTypeFilter) {
      list = list.filter((req) => req.kind === requestTypeFilter);
    }

    if (!statusFilter) {
      if (requestTypeFilter === 'user') return list;

      list = list.filter(
        (req) =>
          !(
            req.kind === 'user' &&
            (req.normalized_status === 'rejected' ||
              req.normalized_status === 'cancelled')
          )
      );
      return list;
    }

    if (statusFilter === 'pending') {
      return list.filter((req) => {
        if (req.kind === 'user') return req.normalized_status === 'pending';
        const code = req.status_detail?.code || '';
        // Treat "changes requested" as part of Pending
        return (
          code === 'pending' ||
          code === 'pending_manager' ||
          code === 'pending_admin' ||
          code === 'changes_requested'
        );
      });
    }

    if (statusFilter === 'rejected') {
      return list.filter((req) => {
        if (requestTypeFilter === 'user')
          return req.kind === 'user' && req.normalized_status === 'rejected';
        if (requestTypeFilter === 'inventory')
          return (
            req.kind === 'inventory' &&
            req.status_detail?.code === 'rejected'
          );
        return (
          (req.kind === 'inventory' &&
            req.status_detail?.code === 'rejected') ||
          (req.kind === 'user' && req.normalized_status === 'rejected')
        );
      });
    }

    if (statusFilter === 'cancelled') {
      return list.filter((req) => {
        if (requestTypeFilter === 'user')
          return req.kind === 'user' && req.normalized_status === 'cancelled';
        if (requestTypeFilter === 'inventory')
          return (
            req.kind === 'inventory' &&
            req.status_detail?.code === 'cancelled'
          );
        return (
          (req.kind === 'inventory' &&
            req.status_detail?.code === 'cancelled') ||
          (req.kind === 'user' && req.normalized_status === 'cancelled')
        );
      });
    }

    return list.filter((req) => {
      if (req.kind === 'user') return req.normalized_status === statusFilter;
      return req.status_detail?.code === statusFilter;
    });
  }, [
    combinedRequests,
    isOwnerUser,
    isBranchManager,
    requestTypeFilter,
    statusFilter,
  ]);

  const visibleRequests = useMemo(() => {
    if (filteredRequests.length === 0) return filteredRequests;
    const limit = Math.min(visibleCount, filteredRequests.length);
    return filteredRequests.slice(0, limit);
  }, [filteredRequests, visibleCount]);

  const hasMore = visibleCount < filteredRequests.length;

  const handleScroll = (e) => {
    if (!hasMore) return;
    const t = e.currentTarget;
    if (!t) return;
    const { scrollTop, clientHeight, scrollHeight } = t;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      setVisibleCount((prev) =>
        prev >= filteredRequests.length
          ? prev
          : Math.min(prev + PAGE_SIZE, filteredRequests.length)
      );
    }
  };

  const combinedLoading = loading || userRequestsLoading;

  const handleCancelInventory = useCallback(
    async (pendingId) => {
      if (typeof onCancelInventoryRequest !== 'function') {
        return;
      }

      setCancelDialogContext({ pendingId });
      setCancelDialogOpen(true);
    },
    [onCancelInventoryRequest]
  );

  const handleCancelUserRequest = useCallback(
    async (pendingUserId) => {
      if (typeof onCancelUserRequest !== 'function') {
        return;
      }

      let confirmed = true;

      if (
        typeof window !== 'undefined' &&
        typeof window.confirm === 'function'
      ) {
        confirmed = window.confirm(
          'Cancel this user request? This action cannot be undone.'
        );
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
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to cancel the request. Please try again.';
        setCancelError(message);
      } finally {
        setCancellingId(null);
      }
    },
    [onCancelUserRequest, triggerRefresh]
  );

  const handleCancelDialogCancel = useCallback(() => {
    if (cancelDialogLoading) return;
    setCancelDialogOpen(false);
    setCancelDialogContext({ pendingId: null });
  }, [cancelDialogLoading]);

  const handleCancelDialogConfirm = useCallback(
    async (reason) => {
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
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to cancel the request. Please try again.';
        setCancelError(message);
      } finally {
        setCancellingId(null);
        setCancelDialogLoading(false);
      }
    },
    [
      cancelDialogContext.pendingId,
      onCancelInventoryRequest,
      triggerRefresh,
      handleCancelDialogCancel,
    ]
  );

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
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-2 sm:px-4"
      onClick={cancelDialogOpen ? undefined : onClose}
    >
      <div
        className="relative flex h-[90vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* HEADER */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-white px-4 sm:px-6 py-4 overflow-visible">
          {/* Title + refresh/close in one row */}
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 break-words">
                Request History
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-gray-500 break-words">
                Review user accounts and inventory requests that need action.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Refresh"
                title="Refresh"
                onClick={() => {
                  triggerRefresh();
                  if (typeof onRefresh === 'function') onRefresh();
                }}
                disabled={loading}
              >
                <MdRefresh
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${
                    loading ? 'animate-spin' : ''
                  }`}
                />
              </button>
              <button
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
                onClick={onClose}
                aria-label="Close request status dialog"
              >
                <IoMdClose className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Filters: Branch -> Status -> Type */}
          {/* Filters: Branch -> Status + Type (desktop side-by-side) */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

            {/* Status + Type grouped */}
            <div className="order-2 col-span-full xl:col-span-2">
              <div className="flex flex-col gap-3 lg:flex-row">
                {/* STATUS CARD */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Status
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {statusFilterOptions.map((filter) => {
                      const isActive = statusFilter === filter.id;
                      return (
                        <button
                          key={filter.id}
                          className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition ${
                            isActive
                              ? 'bg-green-100 text-green-700 ring-1 ring-green-600/40'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          onClick={() =>
                            setStatusFilter(isActive ? '' : filter.id)
                          }
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TYPE CARD */}
                {canSeeTypeFilter && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 lg:w-auto lg:self-stretch">
                    <span className="text-xs font-semibold uppercase text-gray-500">
                      Type
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {requestTypeFilters.map((filter) => {
                        const isActive = requestTypeFilter === filter.id;
                        return (
                          <button
                            key={filter.id}
                            className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/50'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            onClick={() =>
                              setRequestTypeFilter(isActive ? '' : filter.id)
                            }
                          >
                            {filter.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {cancelError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs sm:text-sm text-rose-700">
              {cancelError}
            </div>
          )}
        </div>

        {/* BODY */}
        <div
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4"
          onScroll={handleScroll}
        >
          {combinedLoading ? (
            <div className="py-12">
              <ChartLoading message="Loading request history..." />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-sm text-gray-500">
              <p>No requests match this filter yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleRequests.map((request) => {
                const tone = request.status_detail?.tone || 'slate';
                const toneClass = toneStyles[tone] || toneStyles.slate;

                /* USER REQUEST CARD */
                if (request.kind === 'user') {
                  const rolesLabel = Array.isArray(
                    request.summary?.roles
                  )
                    ? request.summary.roles.join(', ')
                    : '';
                  const branchName =
                    request.branch_name ||
                    findBranchName(branches, request.branch_id) ||
                    '—';
                  const requestedBy =
                    request.created_by_name || 'Branch Manager';
                  const submittedAt = formatDateTime(
                    request.created_at
                  );
                  const email = request.metadata?.email || '—';
                  const phone = request.metadata?.phone || '—';
                  const userStatus = request.user_status || 'pending';
                  const decisionAt = request.decision_at;
                  const ownerStageDescription = (() => {
                    if (userStatus === 'approved')
                      return `Approved${
                        decisionAt
                          ? ` on ${formatDateTime(decisionAt)}`
                          : ''
                      }`;
                    if (userStatus === 'rejected')
                      return `Rejected${
                        decisionAt
                          ? ` on ${formatDateTime(decisionAt)}`
                          : ''
                      }`;
                    if (userStatus === 'cancelled')
                      return `Cancelled${
                        decisionAt
                          ? ` on ${formatDateTime(decisionAt)}`
                          : ''
                      }`;
                    if (isOwnerUser && userStatus === 'pending')
                      return 'For approval';
                    return 'Pending';
                  })();
                  const cancellationReason =
                    request.cancellation_reason;
                  const rejectionReason =
                    request.rejection_reason;
                  const resolutionReason =
                    userStatus === 'cancelled'
                      ? cancellationReason
                      : rejectionReason;
                  const reasonLabel =
                    userStatus === 'cancelled'
                      ? 'Cancellation reason'
                      : 'Reason';
                  const reasonToneClass =
                    userStatus === 'cancelled'
                      ? 'text-slate-600'
                      : 'text-rose-600';
                  const canCancelUser =
                    typeof onCancelUserRequest === 'function' &&
                    currentUserId !== null &&
                    Number.isFinite(
                      Number(
                        request.created_by_id ?? request.created_by
                      )
                    ) &&
                    Number(
                      request.created_by_id ?? request.created_by
                    ) === currentUserId &&
                    request.status_detail &&
                    !request.status_detail.is_final;
                  const cancelKey = request.pending_id;
                  const isCancellingUser =
                    cancellingId === cancelKey;
                  const borderToneClass = (() => {
                    switch (request.status_detail?.tone) {
                      case 'emerald':
                        return 'border-emerald-200';
                      case 'rose':
                        return 'border-rose-200';
                      case 'blue':
                        return 'border-blue-200';
                      default:
                        return 'border-amber-200';
                    }
                  })();

                  const statusLabel = resolveStatusPillLabel(request, {
                    isOwnerUser,
                    isBranchManager,
                  });

                  return (
                    <div
                      key={request.pending_id}
                      className={`rounded-xl border-2 ${borderToneClass} bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1 min-w-0">
                          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-amber-600">
                            User Account
                          </p>
                          <h3 className="text-base sm:text-lg font-semibold text-gray-800 break-words">
                            {request.summary?.product_name ||
                              'User account'}
                          </h3>
                          <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
                            <span>
                              Branch:{' '}
                              <span className="font-medium text-gray-700">
                                {branchName}
                              </span>
                            </span>
                            <span>
                              Submitted:{' '}
                              <span className="font-medium text-gray-700">
                                {submittedAt}
                              </span>
                            </span>
                            <span>
                              Requested by:{' '}
                              <span className="font-medium text-gray-700">
                                {requestedBy}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs sm:text-sm font-semibold whitespace-nowrap ${toneClass.badge}`}
                          >
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`}
                            />
                            {statusLabel}
                          </span>

                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white transition hover:bg-green-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openHistoryModal(request.pending_id);
                            }}
                            aria-label="View request timeline"
                          >
                            <MdHistory className="text-xl" />
                          </button>

                          {canCancelUser && (
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCancelUserRequest(
                                  request.user_id ??
                                    String(
                                      request.pending_id
                                    ).replace(/^user-/, '')
                                );
                              }}
                              disabled={isCancellingUser}
                            >
                              {isCancellingUser
                                ? 'Cancelling…'
                                : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                            Roles
                          </p>
                          <p className="text-sm font-medium text-gray-800 break-words">
                            {rolesLabel || '—'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                            Login Email
                          </p>
                          <p className="text-sm font-medium text-gray-800 break-all">
                            {email}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                            Mobile Number
                          </p>
                          <p className="text-sm font-medium text-gray-800 break-words">
                            {phone}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                          Owner Stage
                        </p>
                        <p className="text-sm text-gray-700 break-words">
                          {ownerStageDescription}
                        </p>
                        {userStatus !== 'pending' &&
                          resolutionReason && (
                            <p
                              className={`mt-2 text-sm break-words ${reasonToneClass}`}
                            >
                              {reasonLabel}: {resolutionReason}
                            </p>
                          )}
                      </div>
                    </div>
                  );
                }

                /* INVENTORY REQUEST CARD */
                const manager = request.timeline?.manager || {};
                const admin = request.timeline?.admin || null;
                const final = request.timeline?.final || {};
                const summary = request.summary || {};
                const branchName =
                  request.branch_name ||
                  findBranchName(branches, request.branch_id) ||
                  'N/A';
                const creatorIdRaw = request.created_by ?? null;
                const creatorId =
                  creatorIdRaw === null ? NaN : Number(creatorIdRaw);

                // Cancel is allowed only for true "pending" inventory requests
                const canCancelInventory =
                  typeof onCancelInventoryRequest === 'function' &&
                  currentUserId !== null &&
                  Number.isFinite(creatorId) &&
                  creatorId === currentUserId &&
                  request.status === 'pending';

                const inventoryCancelKey = `inventory-${request.pending_id}`;
                const isCancelling =
                  cancellingId === inventoryCancelKey;

                const managerDescription =
                  manager.status === 'completed'
                    ? `Approved by ${
                        manager.approver_name || 'Branch Manager'
                      } on ${formatDateTime(manager.acted_at)}`
                    : 'Awaiting branch manager decision';

                const adminDescription = !request.requires_admin_review
                  ? 'Owner confirmation not required'
                  : admin?.status === 'completed'
                  ? `Approved by ${
                      admin.approver_name || 'Owner'
                    } on ${formatDateTime(admin.acted_at)}`
                  : 'Awaiting owner decision';

                const isOwnerConfirmationNotRequired =
                  !request.requires_admin_review;

                const finalDescription =
                  final.status === 'approved'
                    ? `Completed on ${formatDateTime(final.acted_at)}`
                    : final.status === 'rejected'
                    ? `Rejected on ${formatDateTime(final.acted_at)}`
                    : final.status === 'cancelled'
                    ? `Cancelled on ${formatDateTime(final.acted_at)}`
                    : 'In progress';

                const canMakeChanges =
                  currentUserId !== null &&
                  request.created_by &&
                  Number(currentUserId) ===
                    Number(request.created_by) &&
                  request.status_detail?.code ===
                    'changes_requested';

                // NEW: per-request loading state for "Make changes"
                const isMakingChanges =
                  editingPendingId === request.pending_id; // NEW

                const statusLabel = resolveStatusPillLabel(request, {
                  isOwnerUser,
                  isBranchManager,
                });

                return (
                  <div
                    key={request.pending_id}
                    className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md"
                    onClick={() => {
                      if (
                        currentUserId !== null &&
                        request.created_by &&
                        Number(currentUserId) ===
                          Number(request.created_by) &&
                        request.status_detail?.code ===
                          'changes_requested'
                      ) {
                        if (typeof onOpenEditRequest === 'function') {
                          const changeType =
                            request.change_request_type ||
                            request.payload?.change_request_type ||
                            'quantity';
                          onOpenEditRequest({
                            pendingId: request.pending_id,
                            changeType,
                          });
                        }
                      }
                    }}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1 min-w-0">
                        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {summary.action_label ||
                            'Inventory Request'}
                        </p>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 break-words">
                          {summary.product_name || 'Inventory item'}
                        </h3>
                        <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
                          <span>
                            Branch:{' '}
                            <span className="font-medium text-gray-700">
                              {branchName}
                            </span>
                          </span>
                          <span>
                            Submitted:{' '}
                            <span className="font-medium text-gray-700">
                              {formatDateTime(request.created_at)}
                            </span>
                          </span>
                          <span>
                            Requested by:{' '}
                            <span className="font-medium text-gray-700">
                              {request.created_by_name ||
                                'Unknown user'}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* BADGE + HISTORY BUTTON */}
                      <div className="flex flex-col gap-2 md:items-end">
                        <div className="flex items-center justify-start md:justify-end gap-2">
                          {/* Status pill */}
                          <span
                            className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-1 text-xs sm:text-sm font-semibold whitespace-nowrap ${toneClass.badge}`}
                          >
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`}
                            />
                            {statusLabel}
                          </span>

                          {/* History icon */}
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white transition hover:bg-green-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openHistoryModal(request.pending_id);
                            }}
                            aria-label="View request timeline"
                          >
                            <MdHistory className="text-xl" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                          Quantity Requested
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {summary.quantity_requested !== null &&
                          summary.quantity_requested !== undefined
                            ? `${formatNumber(
                                summary.quantity_requested
                              )} ${summary.unit || ''}`.trim()
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                          Current Quantity
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {summary.current_quantity !== null &&
                          summary.current_quantity !== undefined
                            ? `${formatNumber(
                                summary.current_quantity
                              )} ${summary.unit || ''}`.trim()
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                          Unit Price
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {formatCurrencyValue(summary.unit_price)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                          Unit Cost
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {formatCurrencyValue(summary.unit_cost)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                          Branch Manager Stage
                        </p>
                        <p className="text-sm text-gray-700 break-words">
                          {managerDescription}
                        </p>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-3 ${
                          isOwnerConfirmationNotRequired
                            ? 'border border-gray-300 bg-gray-100'
                            : 'border border-gray-200 bg-white'
                        }`}
                      >
                        <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                          Owner Stage
                        </p>
                        <p
                          className={`text-sm break-words ${
                            isOwnerConfirmationNotRequired
                              ? 'text-slate-500'
                              : 'text-gray-700'
                          }`}
                        >
                          {adminDescription}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 md:col-span-2">
                        <p className="text-[11px] sm:text-xs font-semibold uppercase text-gray-500">
                          Overall Status
                        </p>
                        <p className="text-sm text-gray-700 break-words">
                          {finalDescription}
                        </p>
                      </div>
                    </div>

                    {/* Cancel button – after Overall Status, right-aligned */}
                    {canCancelInventory && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="rounded-lg bg-red-600 px-4 py-1.5 text-xs lg:text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancelInventory(request.pending_id);
                          }}
                          disabled={isCancelling}
                        >
                          {isCancelling ? 'Cancelling…' : 'Cancel'}
                        </button>
                      </div>
                    )}

                    {final.status === 'rejected' &&
                      request.rejection_reason && (
                        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 break-words">
                          <p className="font-semibold">
                            Rejection Reason
                          </p>
                          <p>{request.rejection_reason}</p>
                        </div>
                      )}

                    {final.status === 'cancelled' &&
                      request.cancelled_reason && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 break-words">
                          <p className="font-semibold">
                            Cancellation Reason
                          </p>
                          <p>{request.cancelled_reason}</p>
                        </div>
                      )}

                    {request.status_detail?.code === 'changes_requested' &&
                      (request.change_request_comment ||
                        request.payload?.change_request_comment) && (
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800 break-words flex flex-col gap-2">
                          {/* Title + comment */}
                          <div>
                            <p className="font-semibold">Changes Requested</p>
                            <p>
                              {request.change_request_comment ||
                                request.payload?.change_request_comment}
                            </p>
                          </div>

                          {/* Requested change + Make changes (same row, button right) */}
                          {(request.change_request_type ||
                            request.payload?.change_request_type) && (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-amber-700">
                                Requested change:{' '}
                                <span className="font-medium">
                                  {request.change_request_type ||
                                    request.payload?.change_request_type}
                                </span>
                              </p>

                              {canMakeChanges && (
                                <button
                                  type="button"
                                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs lg:text-[13px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const changeType =
                                      request.payload?.change_request_type ||
                                      request.change_request_type ||
                                      request.payload?.change_type ||
                                      null;

                                    if (typeof onOpenEditRequest === 'function') {
                                      // set loading so the user knows it was clicked
                                      setEditingPendingId(request.pending_id); // NEW
                                      const maybePromise = onOpenEditRequest({
                                        pendingId: request.pending_id,
                                        changeType,
                                      });
                                      // If parent returns a promise, clear loading when it settles
                                      if (
                                        maybePromise &&
                                        typeof maybePromise.finally === 'function'
                                      ) {
                                        maybePromise.finally(() => {
                                          setEditingPendingId(null);
                                        });
                                      }
                                      // If it's not a promise, we'll keep it "Opening…" until dialog closes
                                    }
                                  }}
                                  disabled={isMakingChanges}
                                >
                                  {isMakingChanges ? 'Loading…' : 'Make changes'}
                                </button>
                              )}
                            </div>
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
                    onClick={() =>
                      setVisibleCount((prev) =>
                        prev >= filteredRequests.length
                          ? prev
                          : Math.min(
                              prev + PAGE_SIZE,
                              filteredRequests.length
                            )
                      )
                    }
                  >
                    Load more
                  </button>
                  <p className="text-xs text-gray-400">
                    Showing {visibleRequests.length} of{' '}
                    {filteredRequests.length} requests
                  </p>
                </div>
              ) : (
                <p className="text-center text-xs text-gray-400">
                  Showing all {visibleRequests.length} request
                  {visibleRequests.length === 1 ? '' : 's'}
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
