import React, { useState, useEffect, useRef, useCallback } from 'react';
import NoInfoFound from '../components/common/NoInfoFound.jsx';
import { TbFileExport } from "react-icons/tb";
import { MdRefresh } from "react-icons/md";
import { IoMdClose } from "react-icons/io";
import { exportToCSV, exportToPDF, formatForExport } from "../utils/exportUtils";
import { useAuth } from '../authentication/Authentication';
import { currencyFormat } from '../utils/formatCurrency.js';
import InventoryItemDetailsDialog from '../components/InventoryItemDetailsDialog.jsx';
import ChartLoading from '../components/common/ChartLoading.jsx';
import { FaBoxOpen } from "react-icons/fa6";
import RejectionReasonDialog from '../components/dialogs/RejectionReasonDialog.jsx';
import DropdownCustom from '../components/DropdownCustom';

function ProductInventory({
  branches,
  handleOpen,
  productsData,
  setIsCategory,
  setIsProductTransactOpen,
  sanitizeInput,
  listCategories,
  invetoryLoading,
  pendingRequests = [],
  pendingRequestsLoading = false,
  approvePendingRequest,
  rejectPendingRequest,
  refreshPendingRequests,
  highlightPendingDirective = null,
  onHighlightConsumed
}) {
  const { user } = useAuth();
  const [error, setError] = useState();
  const [searchItem, setSearchItem] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'low', 'max', 'none'
  const [isPendingDialogOpen, setIsPendingDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [pendingRejectId, setPendingRejectId] = useState(null);

  // Track if we already pushed a history state for the pending modal
  const hasPushedPendingModalRef = useRef(false);

  // Loading states for approve/reject actions (store pending_id while processing)
  const [approvingIds, setApprovingIds] = useState(() => new Set());
  const [rejectingIds, setRejectingIds] = useState(() => new Set());

  const isApproving = (id) => approvingIds.has(id);
  const isRejecting = (id) => rejectingIds.has(id);
  const isBusy = (id) => isApproving(id) || isRejecting(id);

  const [highlightedPendingIds, setHighlightedPendingIds] = useState([]);
  const pendingRequestRefs = useRef(new Map());
  const pendingDialogScrollRef = useRef(null);
  const lastHandledPendingHighlightRef = useRef(null);

  const displayPendingApprovals =
    user &&
    user.role &&
    user.role.some(role => ['Branch Manager'].includes(role));

  const formatDateTime = (value) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (error) {
      return value;
    }
  };

  const handleApproveClick = (pendingId) => {
    if (typeof approvePendingRequest !== 'function') return;

    (async () => {
      setApprovingIds(prev => {
        const next = new Set(prev);
        next.add(pendingId);
        return next;
      });

      try {
        await approvePendingRequest(pendingId);
      } finally {
        setApprovingIds(prev => {
          const next = new Set(prev);
          next.delete(pendingId);
          return next;
        });
      }
    })();
  };

  const handleRejectClick = (pendingId) => {
    if (typeof rejectPendingRequest !== 'function') return;

    setPendingRejectId(pendingId);
    setIsRejectDialogOpen(true);
  };

  const handleRejectDialogCancel = () => {
    setIsRejectDialogOpen(false);
    setPendingRejectId(null);
  };

  const handleRejectDialogConfirm = (reason) => {
    if (typeof rejectPendingRequest !== 'function' || pendingRejectId == null) {
      setIsRejectDialogOpen(false);
      setPendingRejectId(null);
      return;
    }

    (async () => {
      setRejectingIds(prev => {
        const next = new Set(prev);
        next.add(pendingRejectId);
        return next;
      });

      try {
        await rejectPendingRequest(pendingRejectId, reason);
      } finally {
        setRejectingIds(prev => {
          const next = new Set(prev);
          next.delete(pendingRejectId);
          return next;
        });
      }
      setIsRejectDialogOpen(false);
      setPendingRejectId(null);
    })();
  };

  // Close handler for Pending dialog that cooperates with browser history
  const handleClosePendingDialog = useCallback(() => {
    if (typeof window !== 'undefined' && hasPushedPendingModalRef.current) {
      // Let the first "Back" just close the modal by popping the pushed state
      window.history.back();
    } else {
      // Fallback if no history state was pushed
      setIsPendingDialogOpen(false);
      setHighlightedPendingIds([]);
    }
  }, []);

  // Lock background scroll + handle browser/device Back when Pending dialog is open
  useEffect(() => {
    if (!isPendingDialogOpen) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const { documentElement, body } = document;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    // Lock scroll on both <html> and <body>
    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    // Push a history state so that the next "Back" only closes the modal
    if (!hasPushedPendingModalRef.current) {
      window.history.pushState(
        { ...(window.history.state || {}), pendingInventoryModal: true },
        ''
      );
      hasPushedPendingModalRef.current = true;
    }

    const handlePopState = (event) => {
      // If the modal was open and history moves back, close the modal
      if (hasPushedPendingModalRef.current) {
        hasPushedPendingModalRef.current = false;
        setIsPendingDialogOpen(false);
        setHighlightedPendingIds([]);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      window.removeEventListener('popstate', handlePopState);
      // If we are cleaning up while still marked as pushed, clear the flag
      if (hasPushedPendingModalRef.current && !isPendingDialogOpen) {
        hasPushedPendingModalRef.current = false;
      }
    };
  }, [isPendingDialogOpen]);

  // NEW: DIALOG STATE
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Show 50 items per page

  const handleSearch = (event) => {
    setSearchItem(sanitizeInput(event.target.value));
    setCurrentPage(1); // Reset to first page when searching
  };

  // RESET PAGINATION WHEN FILTERS CHANGE
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedBranch, selectedStatus]);

  // SET DEFAULT BRANCH FOR NON-OWNERS
  useEffect(() => {
    if (user && user.branch_id && user.role && !user.role.some(r => r === 'Owner')) {
      setSelectedBranch(user.branch_id);
    }
  }, [user]);

  // OPEN DETAILS DIALOG ON ROW CLICK
  const openDetails = (item) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedItem(null);
  };

  // CONTAINS ALL AVAILABLE PRODUCTS WHEN LOADED
  let filteredProducts = productsData;

  // FILTER BY CATEGORY
  filteredProducts = selectedCategory
    ? filteredProducts.filter(item => item.category_id === Number(selectedCategory))
    : filteredProducts;

  // FILTER BY BRANCH
  filteredProducts = selectedBranch
    ? filteredProducts.filter(item => item.branch_id === Number(selectedBranch))
    : filteredProducts;

  // COMPUTE COUNTS BEFORE STATUS FILTER
  const totalUnique = new Set(filteredProducts.map(p => p.product_id)).size;
  const lowStockCount = filteredProducts.filter(p => Number(p.quantity) <= Number(p.min_threshold) &&  Number(p.quantity) !==  0).length;
  const maxStockCount = filteredProducts.filter(p => Number(p.quantity) >= Number(p.max_threshold)).length;
  const noStockCount = filteredProducts.filter(p => Number(p.quantity) === 0).length;

  // FILTER BY STATUS
  if (selectedStatus === 'low') {
    filteredProducts = filteredProducts.filter(p => Number(p.quantity) > 0 && Number(p.quantity) <= Number(p.min_threshold));
  } else if (selectedStatus === 'max') {
    filteredProducts = filteredProducts.filter(p => Number(p.quantity) >= Number(p.max_threshold));
  } else if (selectedStatus === 'none') {
    filteredProducts = filteredProducts.filter(p => Number(p.quantity) === 0);
  }

  // FILTER BY SEARCH
  const filteredData = filteredProducts.filter(product =>
    product.product_name.toLowerCase().includes(searchItem.toLowerCase())
  );

  // PAGINATION LOGIC
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  const setPendingRequestRef = useCallback((pendingId, node) => {
    const map = pendingRequestRefs.current;
    if (!map) return;
    if (node) {
      map.set(pendingId, node);
    } else {
      map.delete(pendingId);
    }
  }, []);

  useEffect(() => {
    if (!highlightPendingDirective || highlightPendingDirective.type !== 'branch-pending') {
      return;
    }

    if (pendingRequestsLoading) {
      return;
    }

    if (lastHandledPendingHighlightRef.current === highlightPendingDirective.triggeredAt) {
      return;
    }

    const targetUserId = Number(highlightPendingDirective.userId);
    const normalizedName = (highlightPendingDirective.userName || '').toLowerCase();

    const matchesDirective = (request) => {
      const createdBy = Number(request.created_by ?? request.created_by_id ?? null);
      if (Number.isFinite(targetUserId) && createdBy === targetUserId) {
        return true;
      }
      if (!normalizedName) {
        return false;
      }
      return (request.created_by_name || '').toLowerCase() === normalizedName;
    };

    const targetIds = (pendingRequests || [])
      .filter(matchesDirective)
      .map(req => req.pending_id);

    lastHandledPendingHighlightRef.current = highlightPendingDirective.triggeredAt;

    if (targetIds.length === 0) {
      onHighlightConsumed?.('branch-pending');
      return;
    }

    setIsPendingDialogOpen(true);
    setHighlightedPendingIds(targetIds);

    const firstId = targetIds[0];
    const targetElement = pendingRequestRefs.current.get(firstId);

    const scrollAction = () => {
      const container = pendingDialogScrollRef.current;
      if (container && targetElement && container.contains(targetElement)) {
        const offset = targetElement.offsetTop - container.offsetTop;
        container.scrollTo({
          top: Math.max(offset - container.clientHeight / 3, 0),
          behavior: 'smooth'
        });
        return;
      }

      if (targetElement && typeof targetElement.scrollIntoView === 'function') {
        targetElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };

    const scrollTimer = setTimeout(scrollAction, 160);
    const clearTimer = setTimeout(() => setHighlightedPendingIds([]), 6000);

    onHighlightConsumed?.('branch-pending');

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightPendingDirective, pendingRequests, pendingRequestsLoading, onHighlightConsumed]);

  // EXPORT FUNCTIONALITY
  const handleExportInventory = (format) => {
    const exportData = formatForExport(filteredData, ['product_id']);
    const filename = `inventory_export_${new Date().toISOString().split('T')[0]}`;

    const customHeaders = ['Product Name', 'Category', 'Unit', 'Stock Quantity', 'Price', 'Threshold'];
    const dataKeys = ['product_name', 'category_name', 'unit', 'quantity', 'unit_price', 'min_threshold'];

    if (format === 'csv') {
      exportToCSV(exportData, filename, customHeaders, dataKeys);
    } else if (format === 'pdf') {
      // Custom column widths: expand Product Name and Category, minimize others
      const columnWidths = [85, 70, 25, 30, 30, 20]; // in mm
      exportToPDF(exportData, filename, {
        title: 'Product Inventory Report',
        customHeaders: customHeaders,
        dataKeys: dataKeys,
        showCategorySummary: exportData.length > 0 && !!exportData[0].category_name,
        columnWidths: columnWidths
      });
    }
  };

  return (
    <div className="pt-20 lg:pt-7 px-4 lg:px-8 pb-6">
      {/* REJECTION REASON */}
      <RejectionReasonDialog
        open={isRejectDialogOpen}
        onCancel={handleRejectDialogCancel}
        onConfirm={handleRejectDialogConfirm}
        sanitizeInput={sanitizeInput}
        title="Reject Inventory Request"
        confirmLabel="Submit Rejection"
      />

      {/* DETAILS DIALOG */}
      <InventoryItemDetailsDialog
        open={isDetailsOpen}
        onClose={closeDetails}
        user={user}
        item={selectedItem}
      />

      <div className="flex items-center justify-between">
        {/* TITLE */}
        <h1 className="text-[33px] leading-[36px] font-bold text-green-900">
          INVENTORY
        </h1>
      </div>

      <hr className="mt-3 mb-6 border-t-4 border-green-800 rounded-lg" />

      {/* ===================== PENDING REQUESTS MODAL ===================== */}
      {displayPendingApprovals && isPendingDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop: click to close */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClosePendingDialog}
          />

          {/* Panel: stop clicks from bubbling to the backdrop */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-popup"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg md:text-xl font-semibold text-gray-800">
                  Pending Inventory Requests
                </h2>
                <p className="text-xs md:text-sm text-gray-500">
                  Review inventory additions or updates awaiting your approval.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {typeof refreshPendingRequests === 'function' && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={refreshPendingRequests}
                    disabled={pendingRequestsLoading}
                    aria-label="Refresh pending inventory requests"
                    title="Refresh pending inventory requests"
                  >
                    <MdRefresh className={`text-xl ${pendingRequestsLoading ? 'animate-spin' : ''}`} />
                    <span className="sr-only">Refresh</span>
                  </button>
                )}
                <button
                  className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded-lg transition"
                  onClick={handleClosePendingDialog}
                  aria-label="Close"
                >
                  <IoMdClose className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-4"
              ref={pendingDialogScrollRef}
            >
              {pendingRequestsLoading ? (
                <div className="py-10">
                  <ChartLoading message="Loading pending inventory approvals..." />
                </div>
              ) : (pendingRequests?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FaBoxOpen className="text-5xl opacity-50 mb-2" />
                  <p className="text-sm italic text-gray-600">
                    No pending requests at the moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => {
                    const { payload } = request;
                    const requestedProduct = payload?.productData || payload;
                    const currentState = payload?.currentState;
                    const isHighlighted = highlightedPendingIds.includes(request.pending_id);

                    return (
                      <div
                        key={request.pending_id}
                        ref={(node) => setPendingRequestRef(request.pending_id, node)}
                        className={`border bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition ${
                          isHighlighted
                            ? 'border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.45)] animate-pulse'
                            : ''
                        }`}
                      >
                        {/* Header Info */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="uppercase text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              {request.action_type === 'update' ? 'Update' : 'Add'}
                            </span>
                            <span className="text-xs text-gray-500">
                              Requested {formatDateTime(request.created_at)}
                            </span>
                            {request.requires_admin_review && (
                              <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                Owner approval required
                              </span>
                            )}
                          </div>

                          {/* Buttons */}
                          <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button
                              className={`flex-1 md:flex-none px-4 py-2 rounded-md text-white text-sm font-medium ${
                                isBusy(request.pending_id)
                                  ? 'bg-green-400 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-700'
                              }`}
                              onClick={() => handleApproveClick(request.pending_id)}
                              disabled={isBusy(request.pending_id)}
                            >
                              {isApproving(request.pending_id) ? (
                                <span className="inline-flex items-center">
                                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                  Processing
                                </span>
                              ) : (
                                'Approve'
                              )}
                            </button>

                            <button
                              className={`flex-1 md:flex-none px-4 py-2 rounded-md text-white text-sm font-medium ${
                                isBusy(request.pending_id)
                                  ? 'bg-red-300 cursor-not-allowed'
                                  : 'bg-red-500 hover:bg-red-600'
                              }`}
                              onClick={() => handleRejectClick(request.pending_id)}
                              disabled={isBusy(request.pending_id)}
                            >
                              {isRejecting(request.pending_id) ? (
                                <span className="inline-flex items-center">
                                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                  Processing
                                </span>
                              ) : (
                                'Reject'
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Product Info */}
                        <h3 className="text-base md:text-lg font-semibold text-gray-800">
                          {requestedProduct?.product_name || 'Unnamed Product'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Submitted by {request.created_by_name || 'Inventory Staff'}
                        </p>

                        <div className="flex flex-col md:flex-row gap-3 text-sm">
                          {/* Requested Update */}
                          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 w-full md:w-1/2">
                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                              Requested Update
                            </p>
                            <ul className="space-y-1 text-amber-900">
                              {requestedProduct?.quantity_added != null && (
                                <li>
                                  <span className="font-medium">Quantity:</span>{' '}
                                  {currentState
                                    ? `${Number(currentState.quantity).toLocaleString()} + `
                                    : ''}
                                  <span className="font-bold">
                                    {requestedProduct.quantity_added}
                                  </span>{' '}
                                  {requestedProduct.unit ?? ''}
                                </li>
                              )}
                              {requestedProduct?.unit_price != null && (request.action_type === 'create' || !currentState || Number(requestedProduct.unit_price) !== Number(currentState.unit_price)) && (
                                <li>
                                  <span className="font-medium">Unit Price:</span> ₱{' '}
                                  {Number(requestedProduct.unit_price).toLocaleString()}
                                </li>
                              )}
                              {requestedProduct?.unit_cost != null && (request.action_type === 'create' || !currentState || Number(requestedProduct.unit_cost) !== Number(currentState.unit_cost)) && (
                                <li>
                                  <span className="font-medium">Unit Cost:</span> ₱{' '}
                                  {Number(requestedProduct.unit_cost).toLocaleString()}
                                </li>
                              )}
                              {(requestedProduct?.min_threshold != null || requestedProduct?.max_threshold != null) &&
                                (request.action_type === 'create' || (!currentState || Number(requestedProduct.min_threshold) !== Number(currentState.min_threshold) || Number(requestedProduct.max_threshold) !== Number(currentState.max_threshold))) && (
                                  <li>
                                    <span className="font-medium">Threshold:</span>{' '}
                                    {requestedProduct.min_threshold} -{' '}
                                    {requestedProduct.max_threshold}
                                  </li>
                                )}
                              {requestedProduct?.product_validity != null && (request.action_type === 'create' || !currentState || requestedProduct.product_validity !== currentState.product_validity) && (
                                <li>
                                  <span className="font-medium">Validity:</span>{' '}
                                  {requestedProduct.product_validity}
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Current Values */}
                          {currentState && (
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 w-full md:w-1/2">
                              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                                Current Values
                              </p>
                              <ul className="space-y-1 text-gray-700">
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
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ===================== /PENDING REQUESTS MODAL END ===================== */}

      {/* SEARCH + FILTERS + ACTIONS */}
      <div className="w-full lg:flex lg:items-center lg:gap-6">
        {/* LEFT: search + filters */}
        <div className="flex flex-col lg:flex-row gap-2 lg:gap-6 flex-1 min-w-0">
          {/* Search */}
          <div className="w-full lg:w-[400px] text-sm lg:text-sm">
            <input
              type="text"
              placeholder="Search Item Name..."
              className="border outline outline-1 outline-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all px-3 py-0 mb-2 lg:mb-0 rounded-lg w-full h-9 leading-none"
              onChange={handleSearch}
            />
          </div>

          {/* Category */}
          <div className="w-full lg:w-auto py-2 lg:py-0">
            <DropdownCustom
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              label="Filter by Category:"
              variant="floating"
              size="sm"
              options={[
                { value: '', label: 'All Categories' },
                ...listCategories.map(cat => ({
                  value: cat.category_id,
                  label: cat.category_name
                }))
              ]}
            />
          </div>

          {/* Branch (if allowed) */}
          {user &&
            user.role &&
            user.role.some(r => ['Branch Manager', 'Owner'].includes(r)) && (
              <div className="w-full lg:w-auto">
                <DropdownCustom
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  label="Filter by Branch:"
                  variant="floating"
                  size="sm"
                  options={[
                    ...(user.role.some(r => r === 'Owner')
                      ? [{ value: '', label: 'All Branch' }]
                      : branches.length !== 0
                        ? []
                        : [{ value: '', label: `${user.branch_name} (Your Branch)` }]),
                    ...branches.map(b => ({
                      value: b.branch_id,
                      label: `${b.branch_name}${
                        b.branch_id === user.branch_id ? ' (Your Branch)' : ''
                      }`
                    }))
                  ]}
                />
              </div>
            )}
        </div>

        {/* RIGHT: actions */}
        <div className="mt-3 lg:mt-0 ml-0 lg:ml-auto grid grid-cols-2 gap-3 items-center w-full lg:w-auto lg:flex lg:flex-nowrap lg:gap-3 shrink-0">

          {/* Inventory Staff only */}
          {user && user.role && user.role.some(r => r === 'Inventory Staff') && (
            <>
              <button
                className="col-span-1 bg-[#007278] text-sm text-white font-medium hover:bg-[#009097] px-5 h-10 rounded-lg transition-all flex items-center justify-center"
                onClick={() => setIsCategory(true)}
              >
                CATEGORIES
              </button>

              <button
                className="col-span-1 bg-[#119200] text-sm text-white font-medium hover:bg-[#56be48] px-5 h-10 rounded-lg transition-all flex items-center justify-center"
                onClick={() => handleOpen('add')}
              >
                ADD ITEMS
              </button>
            </>
          )}

          {/* (Optional) Pendings */}
          {displayPendingApprovals && (
            <div className="col-span-2 lg:col-span-1">
              <button
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 h-10 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-500"
                onClick={() => setIsPendingDialogOpen(true)}
                aria-label="Open pending inventory requests"
              >
                <span className="whitespace-nowrap">Pendings</span>
                <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold bg-white text-amber-700 rounded-full">
                  {pendingRequests?.length ?? 0}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <hr className="border-t-2 my-4 w-full border-gray-500 rounded-lg" />

      {/* INVENTORY COUNTERS CARD */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm sm:p-3 p-5 mb-4">
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Products (ALL) */}
          <div
            className={`flex h-auto items-center justify-center gap-2 px-3 py-1 text-sm rounded-lg border cursor-pointer transition-all
              ${
                selectedStatus === 'all'
                  ? 'bg-blue-300 text-blue-900 border-blue-400 ring-2 ring-blue-400 ring-offset-2 '
                  : 'bg-blue-200 text-gray-700 border-blue-200 hover:bg-blue-100 '
              }`}
            onClick={() => setSelectedStatus('all')}
          >
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-center">
                Total Unique Products
              </span>
              <span className="text-lg font-bold">{totalUnique}</span>
            </div>
          </div>

          {/* Low Stock – uses Near Expiry clicked style */}
          <div
            className={`flex h-auto items-center justify-center gap-2 px-3 py-1 text-sm rounded-lg border cursor-pointer transition-all
              ${
                selectedStatus === 'low'
                  ? 'bg-yellow-300 text-yellow-900 border-yellow-400 ring-2 ring-yellow-400 ring-offset-2'
                  : 'bg-yellow-200 text-gray-700 border-yellow-200 hover:bg-yellow-100'
              }`}
            onClick={() => setSelectedStatus('low')}
          >

            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-center">Low Stock</span>
              <span className="text-lg font-bold">{lowStockCount}</span>
            </div>
          </div>

          {/* Max Stock – green theme, similar treatment */}
          <div
            className={`flex h-auto items-center justify-center gap-2 px-3 py-1 text-sm rounded-lg border cursor-pointer transition-all
              ${
                selectedStatus === 'max'
                  ? 'bg-green-300 text-green-900 border-green-500 ring-2 ring-green-400 ring-offset-2'
                  : 'bg-green-200 text-gray-700 border-green-200 hover:bg-green-100'
              }`}
            onClick={() => setSelectedStatus('max')}
          >

            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-center">Max Stock</span>
              <span className="text-lg font-bold">{maxStockCount}</span>
            </div>
          </div>

          {/* No Stock – uses Expired clicked style */}
          <div
            className={`flex h-auto items-center justify-center gap-2 px-3 py-1 text-sm rounded-lg border cursor-pointer transition-all
              ${
                selectedStatus === 'none'
                  ? 'bg-red-300 text-red-600 border-red-500 ring-2 ring-red-400 ring-offset-2'
                  : 'bg-red-200 text-gray-700 border-red-200 hover:bg-red-100'
              }`}
            onClick={() => setSelectedStatus('none')}
          >
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-center">No Stock</span>
              <span className="text-lg font-bold">{noStockCount}</span>
            </div>
          </div>
        </div>
      </div>


      {/* TABLE */}
      <div className="overflow-x-auto overflow-y-auto h-[65vh] sm:h-[65vh] md:h-[70vh] lg:h-[75vh] xl:h-[60vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6">
        <table
          className={`w-full ${
            filteredData.length === 0 ? 'h-full' : ''
          } divide-y divide-gray-200 text-sm`}
        >
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-40">
                INVENTORY ID
              </th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white">
                ITEM NAME
              </th>

              {user &&
                user.role &&
                user.role.some(role => ['Owner'].includes(role)) && (
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-40">
                    BRANCH
                  </th>
                )}


              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-3">
                UNIT
              </th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-40">
                CATEGORY
              </th>

              

              <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                UNIT PRICE
              </th>

              {user &&
                user.role &&
                user.role.some(role => ['Branch Manager'].includes(role)) && (
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                    UNIT COST
                  </th>
                )}

              <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-4">
                QUANTITY
              </th>

              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-38">
                STATUS
              </th>

              {/* APPEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
              {user &&
                user.role &&
                user.role.some(role => ['Inventory Staff'].includes(role)) && (
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-20">
                    ACTION
                  </th>
                )}
            </tr>
          </thead>

          <tbody className="bg-white relative">
            {invetoryLoading ? (
              <tr>
                <td colSpan="14" className="h-96 text-center">
                  <ChartLoading message="Loading inventory products..." />
                </td>
              </tr>
            ) : currentPageData.length === 0 ? (
              <NoInfoFound col={12} />
            ) : (
              currentPageData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`hover:bg-gray-200/70 h-14 ${
                    (rowIndex + 1) % 2 === 0 ? 'bg-[#F6F6F6]' : ''
                  }`}
                  onClick={() => openDetails(row)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="px-4 py-2 text-center">
                    {`${String(row.branch_id).padStart(2, '0')}${String(
                      row.category_id
                    ).padStart(2, '0')}-${row.product_id}`}
                  </td>
                  <td className="px-4 py-2 font-medium whitespace-nowrap">
                    {row.product_name}
                  </td>

                  {user &&
                    user.role &&
                    user.role.some(role => ['Owner'].includes(role)) && (
                      <td className="px-4 py-2 whitespace-nowrap">
                        {branches.find(b => b.branch_id === row.branch_id)?.branch_name || 'Unknown'}
                      </td>
                    )}
                  <td className="px-4 py-2 font-bold">
                    {row.unit.toUpperCase()}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.category_name}
                  </td>

                  <td className="px-4 py-2 text-right">
                    {currencyFormat(row.unit_price)}
                  </td>

                  {user &&
                    user.role &&
                    user.role.some(role => ['Branch Manager'].includes(role)) && (
                      <td className="px-4 py-2 text-right">
                        {currencyFormat(row.unit_cost)}
                      </td>
                    )}

                  <td className="px-4 py-2 text-right">
                    {Number(row.quantity).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-center w-36">
                    <div
                      className={`inline-flex items-center justify-center h-8 px-4 rounded-full text-[13px] font-medium whitespace-nowrap min-w-[110px] border
      ${
        Number(row.quantity) === 0
          ? 'bg-gray-300 text-gray-800 border-gray-300' // Out of Stock
          : row.quantity <= row.min_threshold
          ? 'bg-[#f05959] text-red-900 border-red-300' // Low Stock
          : row.quantity >= row.max_threshold
          ? 'bg-[#1e5e1b] text-white border-green-900' // Max Stock
          : 'bg-[#61E85C] text-green-700 border-green-300' // In Stock
      }`}
                    >
                      {Number(row.quantity) === 0
                        ? 'Out of Stock'
                        : row.quantity <= row.min_threshold
                        ? 'Low Stock'
                        : row.quantity >= row.max_threshold
                        ? 'Max Stock'
                        : 'In Stock'}
                    </div>
                  </td>

                  {/* APPEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
                  {user &&
                    user.role &&
                    user.role.some(role => ['Inventory Staff'].includes(role)) && (
                      <td
                        className="px-4 py-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          disabled={user.branch_id !== row.branch_id}
                          className="bg-[#007278] hover:bg-[#009097] px-5 py-1 rounded-lg text-white
                                         disabled:bg-gray-400 disabled:cursor-not-allowed"
                          onClick={() => handleOpen('edit', row)}
                        >
                          Update
                        </button>
                      </td>
                    )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        {error && (
          <div className="flex font-bold justify-center px-4 py-4">{error}</div>
        )}
      </div>

      {/* PAGINATION AND CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-3 pb-6 px-3">
        {/* TOP ROW ON MOBILE: ITEM COUNT + PAGINATION */}
        <div className="flex justify-between items-center gap-2 sm:hidden">
          {/* LEFT: ITEM COUNT (MOBILE) */}
          <div className="text-xs text-gray-600 flex-shrink-0">
            {filteredData.length > 0 ? (
              <>
                Showing {startIndex + 1} to{' '}
                {Math.min(endIndex, filteredData.length)} of {filteredData.length}
              </>
            ) : (
              <span></span>
            )}
          </div>

          {/* RIGHT: PAGINATION CONTROLS (MOBILE) */}
          {filteredData.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setCurrentPage(prev => Math.max(prev - 1, 1))
                }
                disabled={currentPage === 1}
                className="px-2 py-1.5 text-xs border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Previous
              </button>
              <span className="text-xs text-gray-600 whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage(prev => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-2 py-1.5 text-xs border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Next
              </button>
            </div>
          )}
        </div>
        {/* END OF MOBILE VIEW */}

        {/* DESKTOP LAYOUT: THREE COLUMNS */}

        {/* LEFT: ITEM COUNT (DESKTOP) */}
        <div className="hidden sm:block text-[13px] text-gray-600 sm:flex-1">
          {filteredData.length > 0 ? (
            <>
              Showing {startIndex + 1} to{' '}
              {Math.min(endIndex, filteredData.length)} of {filteredData.length}{' '}
              items
            </>
          ) : (
            <span></span>
          )}
        </div>

        {/* CENTER: PAGINATION CONTROLS (DESKTOP) */}
        <div className="hidden sm:flex sm:justify-center sm:flex-1">
          {filteredData.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setCurrentPage(prev => Math.max(prev - 1, 1))
                }
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-[13px] border rounded-lg bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Previous
              </button>
              <span className="text-[13px] text-gray-600 whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage(prev => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-[13px] border rounded-lg bg-white hover:bg-gray-200  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: INVENTORY HISTORY BUTTON (BOTH MOBILE & DESKTOP) */}
        <div className="flex justify-end sm:flex-1 gap-3">
          {/* Export dropdown */}
<div className="relative group w-full sm:w-auto">
  <button className="bg-blue-800 hover:bg-blue-600 text-white font-medium px-4 lg:px-5 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-[13px] w-full sm:w-auto">
    <TbFileExport />
    EXPORT
  </button>
  <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 bottom-full mb-2 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
    <button
      onClick={() => handleExportInventory('csv')}
      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-[13px] whitespace-nowrap"
    >
      Export as CSV
    </button>
    <button
      onClick={() => handleExportInventory('pdf')}
      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-[13px] whitespace-nowrap"
    >
      Export as PDF
    </button>
  </div>
</div>


          {/* Show Inventory History */}
          <button
            className="bg-white hover:bg-gray-200 rounded-lg border transition-all py-2 px-3 lg:px-5 text-[13px] whitespace-nowrap w-full sm:w-auto"
            onClick={() => setIsProductTransactOpen(true)}
          >
            Show Inventory History
          </button>
        </div>


      </div>
    </div>
  );
}

export default ProductInventory;





