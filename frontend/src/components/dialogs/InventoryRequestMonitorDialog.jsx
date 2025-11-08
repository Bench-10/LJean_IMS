import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { currencyFormat } from '../../utils/formatCurrency.js';
import ChartLoading from '../common/ChartLoading.jsx';

const toneStyles = {
  slate: {
    badge: 'border-slate-200 bg-slate-50 text-slate-700',
    dot: 'bg-slate-500'
  },
  emerald: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500'
  },
  rose: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500'
  },
  amber: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500'
  },
  blue: {
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500'
  }
};

const statusFilters = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending Manager' },
  { id: 'awaiting_owner', label: 'Awaiting Owner' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' }
];

const requestTypeFilters = [
  { id: 'all', label: 'All' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'user', label: 'User Accounts' }
];

const PAGE_SIZE = 12;

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const formatNumber = (value) => {
  if (value === null || value === undefined) {
    return '—';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return numberFormatter.format(numeric);
};

const formatCurrencyValue = (value) => {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'N/A';
  }

  return currencyFormat(numeric);
};

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return dateTimeFormatter.format(date);
};

const toISOStringSafe = (input) => {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toTime = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getTime();
};

const normalizeRoleArray = (roles) => {
  if (!roles) {
    return [];
  }

  if (Array.isArray(roles)) {
    return roles.filter(Boolean);
  }

  if (typeof roles === 'string') {
    return roles
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeComparableString = (value) => {
  if (!value) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
};

const findBranchName = (branches, branchId) => {
  if (!branchId) return null;
  const numeric = Number(branchId);
  return branches.find((branch) => Number(branch.branch_id) === numeric)?.branch_name || null;
};

const InventoryRequestMonitorDialog = ({ open, onClose, user, branches = [], userRequests = [] }) => {
  const roleList = useMemo(() => {
    if (!user || !user.role) return [];
    return Array.isArray(user.role) ? user.role : [user.role];
  }, [user]);

  const isOwnerUser = roleList.includes('Owner');
  const canViewBranchScope = roleList.includes('Branch Manager') || roleList.includes('Owner');
  const canViewAdminScope = roleList.includes('Owner');

  const defaultScope = useMemo(() => {
    if (canViewAdminScope) return 'admin';
    if (canViewBranchScope) return 'branch';
    return 'user';
  }, [canViewAdminScope, canViewBranchScope]);

  const [scope, setScope] = useState(defaultScope);
  const [branchFilter, setBranchFilter] = useState(() => {
    if (defaultScope === 'branch') {
      if (canViewAdminScope && branches.length > 0) {
        return String(branches[0].branch_id);
      }
      if (user?.branch_id) {
        return String(user.branch_id);
      }
    }
    return '';
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!open) {
      setVisibleCount(PAGE_SIZE);
      return;
    }
    setScope((prev) => (prev === defaultScope ? prev : defaultScope));
  }, [defaultScope, open]);

  useEffect(() => {
    if (!open) return;
    if (scope === 'branch') {
      setBranchFilter((prev) => {
        if (prev) return prev;
        if (canViewAdminScope && branches.length > 0) {
          return String(branches[0].branch_id);
        }
        if (user?.branch_id) {
          return String(user.branch_id);
        }
        return prev;
      });
    } else if (scope === 'user') {
      setBranchFilter('');
    }
  }, [scope, open, canViewAdminScope, branches, user]);

  useEffect(() => {
    if (!open) return;
    if (scope === 'branch' && !branchFilter) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('scope', scope);
        params.set('limit', '50');

        if ((scope === 'branch' || scope === 'admin') && branchFilter) {
          params.set('branch_id', branchFilter);
        }

        const response = await api.get(`/api/items/request-status?${params.toString()}`, {
          signal: controller.signal
        });

        if (!isMounted) return;
        const data = response.data || {};
        const list = Array.isArray(data.requests)
          ? data.requests
          : Array.isArray(data)
            ? data
            : [];
        setRequests(list);
        setMeta(data.meta || null);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch inventory request status feed:', fetchError);
        if (isMounted) {
          setError('Failed to load request status. Please try again.');
          setRequests([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRequests();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [open, scope, branchFilter, refreshIndex]);

  useEffect(() => {
    if (!open) {
      setRequests([]);
      setMeta(null);
      setError(null);
      setStatusFilter('all');
      setRequestTypeFilter('all');
      setVisibleCount(PAGE_SIZE);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setVisibleCount(PAGE_SIZE);
  }, [open, scope, branchFilter, statusFilter, requestTypeFilter, refreshIndex]);

  const availableScopes = useMemo(() => {
    if (canViewAdminScope) {
      return [{ id: 'admin', label: 'All Branches' }];
    }

    const options = [{ id: 'user', label: 'My Requests' }];
    if (canViewBranchScope) {
      options.push({ id: 'branch', label: 'Branch' });
    }
    return options;
  }, [canViewAdminScope, canViewBranchScope]);

  const statusFilterOptions = useMemo(() => {
    if (!isOwnerUser) {
      return statusFilters;
    }

    return statusFilters.filter((filter) => filter.id !== 'pending');
  }, [isOwnerUser]);

  useEffect(() => {
    if (statusFilterOptions.some((filter) => filter.id === statusFilter)) {
      return;
    }

    setStatusFilter('all');
  }, [statusFilterOptions, statusFilter]);

  const inventoryEntries = useMemo(() => {
    if (!Array.isArray(requests)) {
      return [];
    }

    return requests.map((record) => ({ kind: 'inventory', ...record }));
  }, [requests]);

  const normalizedUserRequests = useMemo(() => {
    if (!Array.isArray(userRequests)) {
      return [];
    }

    return userRequests
      .map((record) => {
        const rawStatus = String(record?.request_status || record?.status || '').toLowerCase();
        const normalizedStatus = rawStatus === 'active' ? 'approved' : rawStatus;

        if (!['pending', 'approved', 'rejected'].includes(normalizedStatus)) {
          return null;
        }

        const branchName = record?.branch || findBranchName(branches, record?.branch_id) || null;
        const createdAtIso = toISOStringSafe(
          record?.request_created_at
          || record?.created_at
          || record?.createdAt
          || record?.formated_hire_date
          || null
        );

        const approvedAtIso = toISOStringSafe(
          record?.request_approved_at
          || record?.approved_at
          || record?.approvedAt
          || null
        );

        const decisionAtIso = toISOStringSafe(
          record?.request_decision_at
          || record?.approved_at
          || record?.approvedAt
          || record?.updated_at
          || record?.status_updated_at
          || null
        );

        const lastActivityIso = decisionAtIso || approvedAtIso || createdAtIso;
        const roles = normalizeRoleArray(record?.role);
        const creatorName = record?.created_by_display || record?.created_by || 'Branch Manager';
        const creatorIdValue = record?.created_by_id;
        const createdById = creatorIdValue !== null && creatorIdValue !== undefined
          ? (Number.isFinite(Number(creatorIdValue)) ? Number(creatorIdValue) : null)
          : null;
        const creatorNormalized = normalizeComparableString(creatorName);
        const approverName = record?.request_approved_by || record?.approved_by || null;
        const rejectionReason = record?.request_rejection_reason || record?.rejection_reason || null;

        let statusDetail;
        if (normalizedStatus === 'pending') {
          statusDetail = {
            code: 'pending_admin',
            label: 'Awaiting owner approval',
            tone: 'amber',
            is_final: false,
            stage: 'owner_review'
          };
        } else if (normalizedStatus === 'approved') {
          statusDetail = {
            code: 'approved',
            label: 'Approved',
            tone: 'emerald',
            is_final: true,
            stage: 'owner_review'
          };
        } else {
          statusDetail = {
            code: 'rejected',
            label: 'Rejected',
            tone: 'rose',
            is_final: true,
            stage: 'owner_review'
          };
        }

        const adminTimeline = normalizedStatus === 'pending'
          ? {
              status: 'pending',
              acted_at: null,
              approver_id: null,
              approver_name: null
            }
          : {
              status: normalizedStatus === 'approved' ? 'completed' : 'rejected',
              acted_at: decisionAtIso,
              approver_id: null,
              approver_name: approverName
            };

        const finalTimeline = normalizedStatus === 'pending'
          ? {
              status: 'pending',
              acted_at: null,
              rejection_reason: null
            }
          : {
              status: normalizedStatus,
              acted_at: decisionAtIso,
              rejection_reason: normalizedStatus === 'rejected' ? (rejectionReason || null) : null
            };

        return {
          kind: 'user',
          pending_id: `user-${record.user_id}`,
          user_id: record.user_id,
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
            roles
          },
          timeline: {
            submitted_at: createdAtIso,
            manager: null,
            admin: adminTimeline,
            final: finalTimeline
          },
          metadata: {
            email: record?.username || null,
            phone: record?.cell_number || null,
            requested_roles: roles
          },
          user_status: normalizedStatus,
          decision_at: decisionAtIso,
          rejection_reason: rejectionReason
        };
      })
      .filter(Boolean);
  }, [userRequests, branches]);

  const scopedUserRequests = useMemo(() => {
    if (scope === 'admin') {
      return normalizedUserRequests;
    }

    if (scope === 'branch') {
      const parseBranchId = (value) => {
        if (value === null || value === undefined || value === '') {
          return null;
        }

        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      };

      const explicitBranch = parseBranchId(branchFilter);
      const fallbackBranch = parseBranchId(user?.branch_id);
      const targetBranch = explicitBranch ?? fallbackBranch;

      if (targetBranch === null) {
        return normalizedUserRequests;
      }

      return normalizedUserRequests.filter((request) => parseBranchId(request.branch_id) === targetBranch);
    }

    if (scope === 'user') {
      const currentUserId = user?.user_id ? Number(user.user_id) : null;
      const comparableName = normalizeComparableString(
        [user?.first_name, user?.last_name].filter(Boolean).join(' ')
        || user?.full_name
        || user?.name
        || user?.email
        || user?.username
        || ''
      );

      return normalizedUserRequests.filter((request) => {
        if (currentUserId !== null && request.created_by_id !== null && request.created_by_id !== undefined) {
          return Number(request.created_by_id) === currentUserId;
        }

        if (comparableName) {
          return request.created_by_normalized === comparableName;
        }

        return false;
      });
    }

    return normalizedUserRequests;
  }, [normalizedUserRequests, scope, branchFilter, user]);

  const combinedRequests = useMemo(() => {
    const aggregate = [...inventoryEntries, ...scopedUserRequests];
    return aggregate.sort((a, b) => toTime(b.last_activity_at || b.created_at) - toTime(a.last_activity_at || a.created_at));
  }, [inventoryEntries, scopedUserRequests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') {
      return combinedRequests.filter((entry) => {
        if (requestTypeFilter === 'all') return true;
        if (requestTypeFilter === 'inventory') return entry.kind === 'inventory';
        if (requestTypeFilter === 'user') return entry.kind === 'user';
        return true;
      });
    }

    return combinedRequests.filter((request) => {
      if (requestTypeFilter === 'inventory' && request.kind !== 'inventory') {
        return false;
      }

      if (requestTypeFilter === 'user' && request.kind !== 'user') {
        return false;
      }

      const code = request?.status_detail?.code;
      if (!code) return false;

      if (statusFilter === 'pending') {
        return code === 'pending_manager';
      }

      if (statusFilter === 'awaiting_owner') {
        return code === 'pending_admin';
      }

      return code === statusFilter;
    });
  }, [combinedRequests, statusFilter, requestTypeFilter]);

  const visibleRequests = useMemo(() => {
    if (filteredRequests.length === 0) {
      return filteredRequests;
    }

    const limit = Math.min(visibleCount, filteredRequests.length);
    return filteredRequests.slice(0, limit);
  }, [filteredRequests, visibleCount]);

  const hasMore = visibleCount < filteredRequests.length;

  const handleScroll = (event) => {
    if (!hasMore) return;

    const target = event.currentTarget;
    if (!target) return;

    const { scrollTop, clientHeight, scrollHeight } = target;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      setVisibleCount((prev) => {
        if (prev >= filteredRequests.length) return prev;
        return Math.min(prev + PAGE_SIZE, filteredRequests.length);
      });
    }
  };

  const showScopeSwitcher = availableScopes.length > 1;
  // Only show the branch selector to admins/owners. Branch managers should only
  // view requests for their own branch so the selector is unnecessary.
  const showBranchFilter = canViewAdminScope && scope === 'branch';

  if (!open) {
    return null;
  }

  const handleRefresh = () => setRefreshIndex((prev) => prev + 1);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-full max-w-4xl mx-2 lg:mx-4 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
  <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Request Status</h2>
              <p className="text-sm text-gray-500">
                Review pending user accounts and inventory requests that need action.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                onClick={handleRefresh}
              >
                Refresh
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                onClick={onClose}
                aria-label="Close request status dialog"
              >
                X
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3">
            {showScopeSwitcher && (
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:col-span-2 lg:col-span-1">
                <span className="text-xs font-semibold uppercase text-gray-500">View Scope</span>
                <div className="flex flex-wrap items-center gap-2">
                  {availableScopes.map((option) => {
                    const isActive = scope === option.id;
                    return (
                      <button
                        key={option.id}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                          isActive ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        onClick={() => setScope(option.id)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showBranchFilter && (
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:col-span-2 lg:col-span-1">
                <span className="text-xs font-semibold uppercase text-gray-500">Branch</span>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={branchFilter}
                  onChange={(event) => setBranchFilter(event.target.value)}
                >
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <span className="text-xs font-semibold uppercase text-gray-500">Status</span>
              <div className="flex flex-wrap items-center gap-2">
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
                      onClick={() => setStatusFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <span className="text-xs font-semibold uppercase text-gray-500">Type</span>
              <div className="flex flex-wrap items-center gap-2">
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
                      onClick={() => setRequestTypeFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4" onScroll={handleScroll}>
          {loading ? (
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

                if (request.kind === 'user') {
                  const rolesLabel = Array.isArray(request.summary?.roles)
                    ? request.summary.roles.join(', ')
                    : '';
                  const branchName = request.branch_name || findBranchName(branches, request.branch_id) || '—';
                  const requestedBy = request.created_by_name || 'Branch Manager';
                  const submittedAt = formatDateTime(request.created_at);
                  const email = request.metadata?.email || '—';
                  const phone = request.metadata?.phone || '—';
                  const userStatus = request.user_status || 'pending';
                  const decisionAt = request.decision_at;
                  const ownerStageDescription = (() => {
                    if (userStatus === 'approved') {
                      const stamp = decisionAt ? ` on ${formatDateTime(decisionAt)}` : '';
                      return `Approved${stamp}`;
                    }
                    if (userStatus === 'rejected') {
                      const stamp = decisionAt ? ` on ${formatDateTime(decisionAt)}` : '';
                      return `Rejected${stamp}`;
                    }
                    return 'Awaiting owner approval';
                  })();
                  const rejectionReason = request.rejection_reason;
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
                            <span>
                              Branch:{' '}
                              <span className="font-medium text-gray-700">{branchName}</span>
                            </span>
                            <span>
                              Submitted:{' '}
                              <span className="font-medium text-gray-700">{submittedAt}</span>
                            </span>
                            <span>
                              Requested by:{' '}
                              <span className="font-medium text-gray-700">{requestedBy}</span>
                            </span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${toneClass.badge}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`} />
                          {request.status_detail?.label || 'Pending'}
                        </span>
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
                        {userStatus === 'rejected' && rejectionReason && (
                          <p className="mt-2 text-sm text-rose-600">Reason: {rejectionReason}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                const manager = request.timeline?.manager || {};
                const admin = request.timeline?.admin || null;
                const final = request.timeline?.final || {};
                const summary = request.summary || {};
                const statusLabel = request.status_detail?.label || request.status;
                const branchName = request.branch_name || findBranchName(branches, request.branch_id) || 'N/A';

                const managerDescription = manager.status === 'completed'
                  ? `Approved by ${manager.approver_name || 'Branch Manager'} on ${formatDateTime(manager.acted_at)}`
                  : 'Awaiting branch manager decision';

                const adminDescription = !request.requires_admin_review
                  ? 'Owner confirmation not required'
                  : admin?.status === 'completed'
                    ? `Approved by ${admin.approver_name || 'Owner'} on ${formatDateTime(admin.acted_at)}`
                    : 'Awaiting owner decision';

                const finalDescription = final.status === 'approved'
                  ? `Completed on ${formatDateTime(final.acted_at)}`
                  : final.status === 'rejected'
                    ? `Rejected on ${formatDateTime(final.acted_at)}`
                    : 'In progress';

                return (
                  <div key={request.pending_id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {summary.action_label || 'Inventory Request'}
                        </p>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {summary.product_name || 'Inventory item'}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                          <span>Branch: <span className="font-medium text-gray-700">{branchName}</span></span>
                          <span>Submitted: <span className="font-medium text-gray-700">{formatDateTime(request.created_at)}</span></span>
                          <span>Requested by: <span className="font-medium text-gray-700">{request.created_by_name || 'Unknown user'}</span></span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${toneClass.badge}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`} />
                        {statusLabel}
                      </span>
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
                        <p className="text-sm text-gray-700">
                          {finalDescription}
                        </p>
                      </div>
                    </div>

                    {final.status === 'rejected' && request.rejection_reason && (
                      <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                        <p className="font-semibold">Rejection Reason</p>
                        <p>{request.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <button
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                    onClick={() =>
                      setVisibleCount((prev) => {
                        if (prev >= filteredRequests.length) return prev;
                        return Math.min(prev + PAGE_SIZE, filteredRequests.length);
                      })
                    }
                  >
                    Load more
                  </button>
                  <p className="text-xs text-gray-400">
                    Showing {visibleRequests.length} of {filteredRequests.length} requests
                  </p>
                </div>
              )}
              {!hasMore && (
                <p className="text-center text-xs text-gray-400">
                  Showing all {visibleRequests.length} request{visibleRequests.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default InventoryRequestMonitorDialog;
