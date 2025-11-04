import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { currencyFormat } from '../../utils/formatCurrency.js';
import ChartLoading from '../common/ChartLoading.jsx';

const toneStyles = {
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
  },
  slate: {
    badge: 'border-gray-200 bg-gray-50 text-gray-700',
    dot: 'bg-gray-500'
  }
};

const statusFilters = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Manager Pending' },
  { id: 'awaiting_owner', label: 'Awaiting Owner' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' }
];

const PAGE_SIZE = 10;

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch (
    error
  ) {
    return value;
  }
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 'N/A' : numeric.toLocaleString('en-US');
};

const formatCurrencyValue = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 'N/A';
  return currencyFormat(numeric);
};

const findBranchName = (branches, branchId) => {
  if (!branchId) return null;
  const numeric = Number(branchId);
  return branches.find((branch) => Number(branch.branch_id) === numeric)?.branch_name || null;
};

const InventoryRequestMonitorDialog = ({ open, onClose, user, branches = [] }) => {
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
      setVisibleCount(PAGE_SIZE);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setVisibleCount(PAGE_SIZE);
  }, [open, scope, branchFilter, statusFilter, refreshIndex]);

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

    return statusFilters.filter((filter) => filter.id !== 'pending' && filter.id !== 'awaiting_owner');
  }, [isOwnerUser]);

  useEffect(() => {
    if (statusFilterOptions.some((filter) => filter.id === statusFilter)) {
      return;
    }

    setStatusFilter('all');
  }, [statusFilterOptions, statusFilter]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') {
      return requests;
    }

    return requests.filter((request) => {
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
  }, [requests, statusFilter]);

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
  const showBranchFilter = !canViewAdminScope && scope === 'branch';

  if (!open) {
    return null;
  }

  const handleRefresh = () => setRefreshIndex((prev) => prev + 1);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
  <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Inventory Request Status</h2>
              <p className="text-sm text-gray-500">
                Track the progress of inventory additions and updates for your role.
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

          <div className="flex flex-col gap-3">
            {showScopeSwitcher && (
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
            )}

            <div className="flex flex-wrap items-center gap-3">
              {showBranchFilter && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-gray-500">Branch</span>
                  <select
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
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

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-gray-500">Status</span>
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
                const manager = request.timeline?.manager || {};
                const admin = request.timeline?.admin || null;
                const final = request.timeline?.final || {};
                const statusLabel = request.status_detail?.label || request.status;
                const branchName = request.branch_name || findBranchName(branches, request.branch_id) || 'N/A';

                const managerDescription = manager.status === 'completed'
                  ? `Approved by ${manager.approver_name || 'Branch Manager'} on ${formatDateTime(manager.acted_at)}`
                  : 'Awaiting branch manager decision';

                const adminDescription = !request.requires_admin_review
                  ? 'Owner confirmation not required'
                  : admin?.status === 'completed'
                    ? `Approved by ${admin.approver_name || 'Owner'} on ${formatDateTime(admin.acted_at)}`
                    : admin?.status === 'pending'
                      ? 'Awaiting owner decision'
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
                          {request.summary?.action_label || 'Inventory Request'}
                        </p>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {request.summary?.product_name || 'Inventory item'}
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
                          {request.summary?.quantity_requested !== null
                            ? `${formatNumber(request.summary.quantity_requested)} ${request.summary?.unit || ''}`.trim()
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Current Quantity</p>
                        <p className="text-sm font-medium text-gray-800">
                          {request.summary?.current_quantity !== null
                            ? `${formatNumber(request.summary.current_quantity)} ${request.summary?.unit || ''}`.trim()
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Unit Price</p>
                        <p className="text-sm font-medium text-gray-800">{formatCurrencyValue(request.summary?.unit_price)}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Unit Cost</p>
                        <p className="text-sm font-medium text-gray-800">{formatCurrencyValue(request.summary?.unit_cost)}</p>
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
