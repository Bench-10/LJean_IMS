import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import ChartLoading from "../components/common/ChartLoading";
import NoInfoFound from "../components/common/NoInfoFound";
import { MdInfoOutline } from "react-icons/md";
import { IoMdClose } from "react-icons/io";
import { useAuth } from "../authentication/Authentication";
import RejectionReasonDialog from "../components/dialogs/RejectionReasonDialog";
import useModalLock from "../hooks/useModalLock";
import { useLocation, useNavigate } from "react-router-dom";

/* Unified button styles: identical sizes everywhere */
const BTN_BASE =
  "h-8 min-w-[140px] px-4 rounded-lg text-white font-semibold text-sm " +
  "shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-colors whitespace-nowrap";
const BTN_APPROVE_GREEN = `${BTN_BASE} bg-green-600 hover:bg-green-700`;
const BTN_REJECT_RED = `${BTN_BASE} bg-red-600 hover:bg-red-700`;

/**
 * APPROVAL CENTER - Real-time Approval Management
 */
function Approvals({
  userRequests = [],
  userRequestsLoading = false,
  approvePendingAccount,
  rejectPendingAccount,
  sanitizeInput,
  inventoryRequests = [],
  inventoryRequestsLoading = false,
  approveInventoryRequest,
  rejectInventoryRequest,
  refreshInventoryRequests,
  refreshUserRequests,
  onOpenRequestMonitor,
  onRequestChanges,
  highlightDirective = null,
  onHighlightConsumed,
}) {
  const [searchItem, setSearchItem] = useState("");
  const [approvingUserId, setApprovingUserId] = useState(null);
  const [processingInventoryId, setProcessingInventoryId] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectDialogContext, setRejectDialogContext] = useState({
    type: null,
    targetId: null,
  });
  const [rejectDialogLoading, setRejectDialogLoading] = useState(false);
  const [rejectingUserId, setRejectingUserId] = useState(null);

  // Selected pending user for the "User Information" modal
  const [selectedPendingUser, setSelectedPendingUser] = useState(null);
  const [userApprovalModalOpen, setUserApprovalModalOpen] = useState(false);

  // Selected inventory request for the "Inventory Information" modal
  const [selectedInventoryRequest, setSelectedInventoryRequest] =
    useState(null);
  const [inventoryApprovalModalOpen, setInventoryApprovalModalOpen] =
    useState(false);

  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [highlightedInventoryIds, setHighlightedInventoryIds] = useState([]);
  const [highlightedUserIds, setHighlightedUserIds] = useState([]);
  const pendingRowRefs = useRef(new Map());
  const pendingMobileRefs = useRef(new Map());
  const pendingUserRowRefs = useRef(new Map());
  const pendingUserMobileRefs = useRef(new Map());
  const tableScrollContainerRef = useRef(null);
  const mobileScrollContainerRef = useRef(null);
  const lastHandledHighlightRef = useRef(null);

  const ownerCanOpenRequestMonitor = useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.role)
      ? user.role
      : user.role
      ? [user.role]
      : [];
    return roles.includes("Owner");
  }, [user]);

  const openUserApprovalModal = useCallback((pendingUser) => {
    setSelectedPendingUser(pendingUser);
    setUserApprovalModalOpen(true);
  }, []);

  const closeUserApprovalModal = useCallback(() => {
    setSelectedPendingUser(null);
    setUserApprovalModalOpen(false);
  }, []);

  const openInventoryApprovalModal = useCallback((request) => {
    setSelectedInventoryRequest(request);
    setInventoryApprovalModalOpen(true);
  }, []);

  const closeInventoryApprovalModal = useCallback(() => {
    setSelectedInventoryRequest(null);
    setInventoryApprovalModalOpen(false);
  }, []);

  const handleSearch = (event) => {
    if (!sanitizeInput) {
      setSearchItem(event.target.value);
      return;
    }
    setSearchItem(sanitizeInput(event.target.value));
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  const pendingUsers = useMemo(() => {
    if (!Array.isArray(userRequests)) return [];
    const normalizedSearch = searchItem.toLowerCase();

    return userRequests
      .filter((request) => {
        const status = String(
          request?.request_status ??
            request?.status ??
            request?.resolution_status ??
            ""
        ).toLowerCase();
        return status === "pending";
      })
      .filter((request) => {
        if (!normalizedSearch) return true;
        const fullName = String(request?.full_name ?? "").toLowerCase();
        const branchName = String(
          request?.branch_name ?? request?.branch ?? ""
        ).toLowerCase();
        const roleLabel = Array.isArray(request?.role)
          ? request.role.join(", ").toLowerCase()
          : String(request?.role ?? "").toLowerCase();
        return (
          fullName.includes(normalizedSearch) ||
          branchName.includes(normalizedSearch) ||
          roleLabel.includes(normalizedSearch)
        );
      });
  }, [userRequests, searchItem]);

  // Core approve logic for user accounts. Used by row buttons and modal.
  const approvePendingUser = useCallback(
    async (pendingUser) => {
      if (!approvePendingAccount || !pendingUser) return;

      const numericUserId = Number(pendingUser.user_id);
      if (!Number.isFinite(numericUserId)) return;

      try {
        setApprovingUserId(numericUserId);
        await approvePendingAccount(numericUserId);

        if (typeof refreshUserRequests === "function") {
          await refreshUserRequests();
        }
      } catch (error) {
        console.error("Error approving user:", error);
      } finally {
        setApprovingUserId(null);
      }
    },
    [approvePendingAccount, refreshUserRequests]
  );

  const handleApprove = async (event, pendingUser) => {
    event?.stopPropagation?.();
    await approvePendingUser(pendingUser);
  };

  // Modal-specific approve handler → closes modal first (snappy UX)
  const handleModalApprove = async () => {
    if (!selectedPendingUser) return;
    const userToApprove = selectedPendingUser;
    closeUserApprovalModal();
    await approvePendingUser(userToApprove);
  };

  const pendingInventoryRequests = useMemo(() => {
    if (!Array.isArray(inventoryRequests)) return [];
    const normalizedSearch = searchItem.toLowerCase();

    return inventoryRequests
      .filter((request) => {
        const status = String(
          request?.status ??
            request?.request_status ??
            request?.resolution_status ??
            ""
        ).toLowerCase();
        return request.current_stage === "admin_review" && status === "pending";
      })
      .filter((request) => {
        if (!normalizedSearch) return true;
        const payload = request.payload || {};
        const productData = payload.productData || payload;
        const productNameMatch = productData?.product_name
          ?.toLowerCase()
          .includes(normalizedSearch);
        const branchMatch = request.branch_name
          ?.toLowerCase()
          .includes(normalizedSearch);
        const creatorMatch = request.created_by_name
          ?.toLowerCase()
          .includes(normalizedSearch);
        return productNameMatch || branchMatch || creatorMatch;
      });
  }, [inventoryRequests, searchItem]);

  const combinedRequests = useMemo(() => {
    const toTime = (value) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    const userEntries = pendingUsers.map((record) => ({
      kind: "user",
      createdAt:
        record.request_created_at ??
        record.created_at ??
        record.createdAt ??
        null,
      record,
    }));

    const inventoryEntries = pendingInventoryRequests.map((record) => ({
      kind: "inventory",
      createdAt: record.created_at ?? null,
      record,
    }));

    return [...userEntries, ...inventoryEntries].sort(
      (a, b) => toTime(b.createdAt) - toTime(a.createdAt)
    );
  }, [pendingUsers, pendingInventoryRequests]);

  const combinedLoading = userRequestsLoading || inventoryRequestsLoading;


  useEffect(() => {
    const state = location.state;
    if (!state || state.kind !== "user-request") return;

    // Try to identify which user to open
    const pendingUserIdRaw =
      state.pendingUserId ?? state.userId ?? state.targetUserId ?? null;
    const pendingUserId = Number(pendingUserIdRaw);
    const email = (state.pendingUserEmail || "").toLowerCase();
    const fullName = (state.pendingUserName || "").toLowerCase();

    // Wait until user requests are loaded
    if (userRequestsLoading) return;
    if (!Array.isArray(pendingUsers) || pendingUsers.length === 0) return;

    let match = null;

    if (Number.isFinite(pendingUserId)) {
      match =
        pendingUsers.find(
          (u) =>
            Number(u.user_id) === pendingUserId ||
            Number(u.id) === pendingUserId
        ) || null;
    }

    if (!match && email) {
      match =
        pendingUsers.find(
          (u) =>
            String(u.username || u.email || "")
              .toLowerCase() === email
        ) || null;
    }

    if (!match && fullName) {
      match =
        pendingUsers.find(
          (u) => String(u.full_name || "").toLowerCase() === fullName
        ) || null;
    }

    if (!match) return;

    //Open the modal for that specific user
    openUserApprovalModal(match);

    // Clear the navigation state so reload doesn't re-open it
    navigate(location.pathname, { replace: true, state: null });
  }, [
    location.state,
    pendingUsers,
    userRequestsLoading,
    openUserApprovalModal,
    navigate,
    location.pathname,
  ]);

  const setPendingRowRef = useCallback((pendingId, node) => {
    const map = pendingRowRefs.current;
    if (!map) return;
    if (node) map.set(pendingId, node);
    else map.delete(pendingId);
  }, []);

  const setPendingMobileRef = useCallback((pendingId, node) => {
    const map = pendingMobileRefs.current;
    if (!map) return;
    if (node) map.set(pendingId, node);
    else map.delete(pendingId);
  }, []);

  const setPendingUserRowRef = useCallback((userId, node) => {
    const map = pendingUserRowRefs.current;
    if (!map) return;
    if (node) map.set(userId, node);
    else map.delete(userId);
  }, []);

  const setPendingUserMobileRef = useCallback((userId, node) => {
    const map = pendingUserMobileRefs.current;
    if (!map) return;
    if (node) map.set(userId, node);
    else map.delete(userId);
  }, []);

  // Highlight: user approvals
  useEffect(() => {
    if (!highlightDirective || highlightDirective.type !== "owner-approvals")
      return;
    const focusKind = highlightDirective.focusKind || "inventory";
    if (focusKind !== "user") return;
    if (userRequestsLoading) return;
    if (lastHandledHighlightRef.current === highlightDirective.triggeredAt)
      return;

    const directiveTargetIds = Array.isArray(highlightDirective.targetIds)
      ? highlightDirective.targetIds
          .map((value) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
          })
          .filter((value) => value !== null)
      : [];

    const targetUserId = Number(highlightDirective.userId);
    const normalizedName = (highlightDirective.userName || "").toLowerCase();

    const matchesDirective = (record) => {
      if (!record) return false;

      const numericId = Number(record.user_id);
      if (directiveTargetIds.length > 0)
        return directiveTargetIds.includes(numericId);
      if (Number.isFinite(targetUserId) && numericId === targetUserId)
        return true;
      if (!normalizedName) return false;
      return (record.full_name || "").toLowerCase() === normalizedName;
    };

    let candidateIds = pendingUsers
      .filter(matchesDirective)
      .map((record) => Number(record.user_id))
      .filter((value) => Number.isFinite(value));

    if (candidateIds.length === 0 && directiveTargetIds.length > 0) {
      candidateIds = directiveTargetIds.filter((id) =>
        pendingUsers.some((record) => Number(record.user_id) === id)
      );
    }

    lastHandledHighlightRef.current = highlightDirective.triggeredAt;

    if (candidateIds.length === 0) {
      onHighlightConsumed?.("owner-approvals");
      return;
    }

    setHighlightedUserIds(candidateIds);
    setHighlightedInventoryIds([]);

    const isMobileView =
      typeof window !== "undefined"
        ? window.matchMedia("(max-width: 767px)").matches
        : false;

    const firstId = candidateIds[0];
    const preferredElement = isMobileView
      ? pendingUserMobileRefs.current.get(firstId) ||
        pendingUserRowRefs.current.get(firstId)
      : pendingUserRowRefs.current.get(firstId) ||
        pendingUserMobileRefs.current.get(firstId);

    const fallbackElement = isMobileView
      ? pendingUserRowRefs.current.get(firstId)
      : pendingUserMobileRefs.current.get(firstId);

    const targetElement = preferredElement || fallbackElement;
    const scrollContainer = isMobileView
      ? mobileScrollContainerRef.current
      : tableScrollContainerRef.current;

    const scrollAction = () => {
      if (
        scrollContainer &&
        targetElement &&
        scrollContainer.contains(targetElement)
      ) {
        const offset = targetElement.offsetTop - scrollContainer.offsetTop;
        scrollContainer.scrollTo({
          top: Math.max(offset - scrollContainer.clientHeight / 3, 0),
          behavior: "smooth",
        });
        return;
      }
      if (targetElement && typeof targetElement.scrollIntoView === "function") {
        targetElement.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };

    const scrollTimer = setTimeout(scrollAction, 140);
    const clearTimer = setTimeout(() => setHighlightedUserIds([]), 6000);

    onHighlightConsumed?.("owner-approvals");

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [
    highlightDirective,
    pendingUsers,
    userRequestsLoading,
    onHighlightConsumed,
  ]);

  // Highlight: inventory approvals
  useEffect(() => {
    if (!highlightDirective || highlightDirective.type !== "owner-approvals")
      return;
    const focusKind = highlightDirective.focusKind || "inventory";
    if (focusKind === "user") return;
    if (inventoryRequestsLoading) return;
    if (lastHandledHighlightRef.current === highlightDirective.triggeredAt)
      return;

    const directiveTargetIds = Array.isArray(highlightDirective.targetIds)
      ? highlightDirective.targetIds
          .map((value) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
          })
          .filter((value) => value !== null)
      : [];

    const targetUserId = Number(highlightDirective.userId);
    const normalizedName = (highlightDirective.userName || "").toLowerCase();

    const matchesDirective = (request) => {
      const createdBy = Number(
        request.created_by ??
          request.created_by_id ??
          request.user_id ??
          null
      );
      if (Number.isFinite(targetUserId) && createdBy === targetUserId)
        return true;
      if (!normalizedName) return false;
      return (request.created_by_name || "").toLowerCase() === normalizedName;
    };

    let targetIds = [];

    if (directiveTargetIds.length > 0) {
      targetIds = (inventoryRequests || [])
        .filter((req) => directiveTargetIds.includes(Number(req.pending_id)))
        .map((req) => req.pending_id);
    } else {
      targetIds = (inventoryRequests || [])
        .filter(matchesDirective)
        .map((req) => req.pending_id);
    }

    lastHandledHighlightRef.current = highlightDirective.triggeredAt;

    if (targetIds.length === 0) {
      onHighlightConsumed?.("owner-approvals");
      return;
    }

    setHighlightedInventoryIds(targetIds);
    setHighlightedUserIds([]);

    const isMobileView =
      typeof window !== "undefined"
        ? window.matchMedia("(max-width: 767px)").matches
        : false;

    const firstId = targetIds[0];
    const preferredElement = isMobileView
      ? pendingMobileRefs.current.get(firstId) ||
        pendingRowRefs.current.get(firstId)
      : pendingRowRefs.current.get(firstId) ||
        pendingMobileRefs.current.get(firstId);

    const fallbackElement = isMobileView
      ? pendingRowRefs.current.get(firstId)
      : pendingMobileRefs.current.get(firstId);

    const targetElement = preferredElement || fallbackElement;
    const scrollContainer = isMobileView
      ? mobileScrollContainerRef.current
      : tableScrollContainerRef.current;

    const scrollAction = () => {
      if (
        scrollContainer &&
        targetElement &&
        scrollContainer.contains(targetElement)
      ) {
        const offset = targetElement.offsetTop - scrollContainer.offsetTop;
        scrollContainer.scrollTo({
          top: Math.max(offset - scrollContainer.clientHeight / 3, 0),
          behavior: "smooth",
        });
        return;
      }

      if (targetElement && typeof targetElement.scrollIntoView === "function") {
        targetElement.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };

    const scrollTimer = setTimeout(scrollAction, 140);
    const clearTimer = setTimeout(
      () => setHighlightedInventoryIds([]),
      6000
    );

    onHighlightConsumed?.("owner-approvals");

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [
    highlightDirective,
    inventoryRequests,
    inventoryRequestsLoading,
    onHighlightConsumed,
  ]);

  const handleInventoryApprove = async (pendingId) => {
    if (!approveInventoryRequest) return;
    try {
      setProcessingInventoryId(pendingId);
      await approveInventoryRequest(pendingId);
      if (typeof refreshInventoryRequests === "function") {
        await refreshInventoryRequests();
      }
    } catch (error) {
      console.error("Error approving inventory request:", error);
    } finally {
      setProcessingInventoryId(null);
    }
  };

  const handleInventoryReject = (pendingId) => {
    if (!rejectInventoryRequest) return;
    setRejectDialogContext({ type: "inventory", targetId: pendingId });
    setRejectDialogOpen(true);
  };

  const handleInventoryRequestChanges = async (pendingId) => {
    if (!onRequestChanges) return;
    // Simple prompt UI temporarily: ask for change type and comment
    const changeType = window.prompt('Enter change type (quantity, product_info, other):', 'quantity');
    if (!changeType) return;
    const comment = window.prompt('Enter comments for the user (what needs to be changed):', 'Please update the quantity to proper value');
    try {
      await onRequestChanges(pendingId, changeType, comment);
      if (typeof refreshInventoryRequests === 'function') await refreshInventoryRequests();
    } catch (error) {
      console.error('Failed to request changes for the pending inventory request:', error);
    }
  };

  const handleUserReject = (event, pendingUser) => {
    if (!rejectPendingAccount) return;
    event?.stopPropagation?.();
    const targetId = Number(pendingUser?.user_id);
    if (!Number.isFinite(targetId)) return;
    setRejectDialogContext({ type: "user", targetId });
    setRejectDialogOpen(true);
  };

  const handleModalInventoryApprove = async () => {
    if (!selectedInventoryRequest) return;
    const pendingId = selectedInventoryRequest.pending_id;
    closeInventoryApprovalModal();
    await handleInventoryApprove(pendingId);
  };

  const handleModalInventoryReject = () => {
    if (!selectedInventoryRequest) return;
    handleInventoryReject(selectedInventoryRequest.pending_id);
  };

  const handleRejectDialogCancel = () => {
    if (rejectDialogLoading) return;
    setRejectDialogOpen(false);
    setRejectDialogContext({ type: null, targetId: null });
    setRejectingUserId(null);
  };

  const handleRejectDialogConfirm = async (reason) => {
    if (!rejectDialogContext.type || rejectDialogContext.targetId === null) {
      handleRejectDialogCancel();
      return;
    }

    const targetId = rejectDialogContext.targetId;
    setRejectDialogLoading(true);

    try {
      if (rejectDialogContext.type === "inventory") {
        if (!rejectInventoryRequest) return;
        setProcessingInventoryId(targetId);
        await rejectInventoryRequest(targetId, reason);
        if (typeof refreshInventoryRequests === "function") {
          await refreshInventoryRequests();
        }
        setProcessingInventoryId(null);
        setSelectedInventoryRequest(null);
        setInventoryApprovalModalOpen(false);
      } else if (rejectDialogContext.type === "user") {
        if (!rejectPendingAccount) return;
        setRejectingUserId(targetId);
        await rejectPendingAccount(targetId, reason);
        if (typeof refreshUserRequests === "function") {
          await refreshUserRequests();
        }
        setRejectingUserId(null);
        setSelectedPendingUser(null);
        setUserApprovalModalOpen(false);
      }

      handleRejectDialogCancel();
    } catch (error) {
      console.error("Error rejecting request:", error);
    } finally {
      setRejectDialogLoading(false);
      setProcessingInventoryId(null);
      setRejectingUserId(null);
    }
  };

  const handleModalReject = () => {
    if (!selectedPendingUser) return;
    handleUserReject(null, selectedPendingUser);
  };

  return (
    <div className="pt-20 lg:pt-7 px-3 sm:px-4 lg:px-8 pb-6 min-h-screen bg-[#eef2ee]">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-[33px] leading-[36px] font-bold text-green-900">
           PENDING REQUESTS
        </h1>
        <hr className="mt-2 sm:mt-3 mb-4 sm:mb-6 border-t-4 border-green-800 rounded-lg" />
      </div>

      {/* Search + Actions */}
      <div className="flex w-full flex-col gap-3 sm:gap-4 md:flex-row md:items-center">
        {/* Search */}
        <div className="w-full md:w-[360px] lg:w-[460px] md:mr-auto">
          <input
            type="text"
            placeholder="Search pending request by name, branch, or role"
            className="border outline outline-1 outline-gray-400 
              focus:border-green-500 focus:ring-2 focus:ring-green-200 
              transition-all px-3 mb-2 sm:mb-0 rounded-lg w-full h-[35px] text-sm sm:text-sm"
            onChange={handleSearch}
            value={searchItem}
          />
        </div>

        {/* Actions */}
        {ownerCanOpenRequestMonitor &&
          typeof onOpenRequestMonitor === "function" && (
            <div className="flex items-center gap-2 md:ml-auto">
              <button
                type="button"
                className="w-full px-4 py-2 text-sm rounded-md bg-emerald-700 text-white font-medium transition hover:bg-emerald-600"
                onClick={onOpenRequestMonitor}
              >
                View request status
              </button>
            </div>
          )}
      </div>

      <hr className="border-t-2 my-3 sm:my-4 w-full border-green-800 rounded-lg" />

      {/* DESKTOP TABLE VIEW */}
      <div
        className="hidden md:block overflow-x-auto overflow-y-auto h-[60vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6 bg-white"
        ref={tableScrollContainerRef}
      >
        <table
          className={`w-full ${
            combinedRequests.length === 0 ? "h-full" : ""
          } divide-y divide-gray-200 text-sm`}
        >
          <thead className="sticky top-0 bg-green-500 text-white z-10">
            <tr>
              <th className="px-4 py-2 text-left font-medium w-[260px]">
                Request
              </th>
              <th className="px-4 py-2 text-left font-medium w-48">Branch</th>
              <th className="px-4 py-2 text-left font-medium w-56">
                Requested By
              </th>
              <th className="px-4 py-2 text-left font-medium w-64">Details</th>
              <th className="px-4 py-2 text-center font-medium w-40">
                Status
              </th>
              <th className="px-4 py-2 text-center font-medium w-56">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {combinedLoading ? (
              <tr>
                <td colSpan={6} className="py-10">
                  <ChartLoading message="Loading pending approvals..." />
                </td>
              </tr>
            ) : combinedRequests.length === 0 ? (
              <NoInfoFound
                col={6}
                message="No pending approvals at the moment."
              />
            ) : (
              combinedRequests.map((entry) => {
                if (entry.kind === "user") {
                  const pendingUser = entry.record;
                  const rolesLabel = Array.isArray(pendingUser.role)
                    ? pendingUser.role.join(", ")
                    : pendingUser.role ?? "";
                  const creatorName =
                    pendingUser.created_by_name || "Branch Manager";
                  const numericUserId = Number(pendingUser.user_id);
                  const hasNumericId = Number.isFinite(numericUserId);
                  const isUserHighlighted =
                    hasNumericId && highlightedUserIds.includes(numericUserId);
                  const approvingInProgress =
                    hasNumericId &&
                    Number(approvingUserId) === numericUserId;
                  const rejectingInProgress =
                    hasNumericId &&
                    Number(rejectingUserId) === numericUserId;

                  return (
                    <tr
                      key={`user-${pendingUser.user_id}`}
                      ref={(node) => {
                        if (hasNumericId)
                          setPendingUserRowRef(numericUserId, node);
                      }}
                      className={`h-auto border-b last:border-b-0 hover:bg-amber-50 transition-colors cursor-pointer bg-amber-50/30 ${
                        isUserHighlighted
                          ? "ring-2 ring-amber-400 ring-offset-2 animate-pulse"
                          : ""
                      }`}
                      onClick={() => openUserApprovalModal(pendingUser)}
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          <span className="font-semibold text-gray-800 text-base">
                            {pendingUser.full_name}
                          </span>
                          <span className="inline-flex w-max items-center gap-2 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 border border-amber-200">
                            User Account Approval
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap align-top font-medium">
                        {pendingUser.branch || pendingUser.branch_name || "—"}
                      </td>
                      <td className="px-4 py-4 text-gray-600 whitespace-nowrap align-top">
                        {creatorName}
                      </td>
                      <td className="px-4 py-4 text-gray-700 align-top">
                        <span className="text-sm">
                          Roles: {rolesLabel || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center align-top">
                        <span className="inline-flex items-center justify-center rounded-lg bg-amber-100 px-3 h-7 text-[13px] leading-none font-semibold text-amber-700 border border-amber-300 whitespace-nowrap">
                          For Approval
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center align-top">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className={BTN_APPROVE_GREEN}
                            onClick={(e) => handleApprove(e, pendingUser)}
                            disabled={
                              approvingInProgress || rejectingInProgress
                            }
                          >
                            {approvingInProgress
                              ? "Approving..."
                              : "Approve account"}
                          </button>
                          <button
                            className={BTN_REJECT_RED}
                            onClick={(e) => handleUserReject(e, pendingUser)}
                            disabled={
                              approvingInProgress || rejectingInProgress
                            }
                          >
                            {rejectingInProgress ? "Rejecting..." : "Reject"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const request = entry.record;
                const payload = request.payload || {};
                const productData = payload.productData || payload;
                const categoryLabel = payload.category_name || "—";
                const unitPrice = productData?.unit_price
                  ? `₱ ${Number(productData.unit_price).toLocaleString()}`
                  : "—";
                const unitCost = productData?.unit_cost
                  ? `₱ ${Number(productData.unit_cost).toLocaleString()}`
                  : "—";
                const quantityAdded = productData?.quantity_added != null ? productData.quantity_added : null;

                const isHighlighted = highlightedInventoryIds.includes(
                  request.pending_id
                );

                return (
                  <tr
                    key={`inventory-${request.pending_id}`}
                    ref={(node) => setPendingRowRef(request.pending_id, node)}
                    className={`h-auto border-b last:border-b-0 hover:bg-blue-50 transition-colors bg-blue-50/20 cursor-pointer ${
                      isHighlighted
                        ? "ring-2 ring-amber-400 ring-offset-2 animate-pulse"
                        : ""
                    }`}
                    onClick={() => openInventoryApprovalModal(request)}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <span className="font-semibold text-gray-800 text-base">
                          {productData?.product_name || "Unnamed Product"}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-700 font-semibold px-3 py-1 border border-blue-200">
                            Inventory{" "}
                            {request.action_type === "update"
                              ? "Update"
                              : "Addition"}
                          </span>
                          <span className="text-gray-500">
                            Submitted {formatDateTime(request.created_at)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap align-top font-medium">
                      {request.branch_name || "—"}
                    </td>
                    <td className="px-4 py-4 text-gray-700 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {request.created_by_name || "Inventory Staff"}
                        </span>
                        {request.manager_approver_name && (
                          <span className="text-xs text-gray-500">
                            Forwarded by {request.manager_approver_name} on{" "}
                            {formatDateTime(request.manager_approved_at)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-700 align-top">
                      <div className="text-sm space-y-1.5">
                        <div>
                          <span className="font-medium">Category:</span>{" "}
                          <span>{categoryLabel}</span>
                        </div>

                        <div>
                          <span className="font-medium">Quantity:</span>{' '}
                          <span>{quantityAdded != null ? Number(quantityAdded).toLocaleString() : '—'}</span>
                        </div>

                        <div>
                          <span className="font-medium">Unit Price:</span>{" "}
                          <span>{unitPrice}</span>
                        </div>

                        <div>
                          <span className="font-medium">Unit Cost:</span>{" "}
                          <span>{unitCost}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center align-top">
                      <span className="inline-flex items-center justify-center rounded-lg bg-blue-100 px-3 h-7 text-[13px] leading-none font-semibold text-blue-700 border border-blue-200 whitespace-nowrap">
                        For Approval
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center align-top">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className={BTN_APPROVE_GREEN}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInventoryApprove(request.pending_id);
                          }}
                          disabled={
                            processingInventoryId === request.pending_id
                          }
                        >
                          {processingInventoryId === request.pending_id
                            ? "Processing..."
                            : "Approve"}
                        </button>
                        <button
                          className={BTN_REJECT_RED}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInventoryReject(request.pending_id);
                          }}
                          disabled={
                            processingInventoryId === request.pending_id
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div
        className="md:hidden space-y-3 sm:space-y-4 overflow-y-auto max-h-[70vh] pb-6 hide-scrollbar"
        ref={mobileScrollContainerRef}
      >
        {combinedLoading ? (
          <ChartLoading message="Loading pending approvals..." />
        ) : combinedRequests.length === 0 ? (
          <div className="bg-transparent flex flex-col items-center justify-center h-[180px] w-full rounded-lg border border-dashed border-gray-300 text-center text-sm text-gray-500 py-6">
            <MdInfoOutline
              className="text-3xl text-gray-400 mb-2"
              aria-hidden="true"
            />
            <span className="font-medium italic">
              No pending approvals at the moment.
            </span>
          </div>
        ) : (
          combinedRequests.map((entry) => {
            if (entry.kind === "user") {
              const pendingUser = entry.record;
              const rolesLabel = Array.isArray(pendingUser.role)
                ? pendingUser.role.join(", ")
                : pendingUser.role ?? "";

              const creatorName =
                pendingUser.created_by_name || "Branch Manager";

              const numericUserId = Number(pendingUser.user_id);
              const hasNumericId = Number.isFinite(numericUserId);
              const isUserHighlighted =
                hasNumericId && highlightedUserIds.includes(numericUserId);
              const approvingInProgress =
                hasNumericId && Number(approvingUserId) === numericUserId;
              const rejectingInProgress =
                hasNumericId && Number(rejectingUserId) === numericUserId;

              return (
                <div
                  key={`user-${pendingUser.user_id}`}
                  ref={(node) => {
                    if (hasNumericId)
                      setPendingUserMobileRef(numericUserId, node);
                  }}
                  className={`bg-white border-2 border-amber-300 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
                    isUserHighlighted
                      ? "border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.45)] animate-pulse"
                      : ""
                  }`}
                  onClick={() => openUserApprovalModal(pendingUser)}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      {/* name + User Account Approval on the same top row */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="flex-1 font-semibold text-base sm:text-lg text-gray-900">
                          {pendingUser.full_name}
                        </h3>
                        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 border border-amber-200 whitespace-nowrap">
                          User Account Approval
                        </span>
                      </div>

                      {/* status chip below */}
                      <span className="inline-flex items-center justify-center rounded-lg bg-amber-100 px-3 h-7 text-[13px] leading-none font-semibold text-amber-700 border-amber-300 border whitespace-nowrap">
                        For Approval
                      </span>
                    </div>

                    <div className="space-y-2 text-sm border-t border-gray-200 pt-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-medium text-gray-700">
                          Branch:
                        </span>
                        <span className="text-gray-600">
                          {pendingUser.branch || pendingUser.branch_name || "—"}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-medium text-gray-700">
                          Requested By:
                        </span>
                        <span className="text-gray-600">{creatorName}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                        <span className="font-medium text-gray-700">
                          Roles:
                        </span>
                        <span className="text-gray-600">
                          {rolesLabel || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-2">
                      <button
                        className={BTN_APPROVE_GREEN}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(e, pendingUser);
                        }}
                        disabled={approvingInProgress || rejectingInProgress}
                      >
                        {approvingInProgress ? "Approving..." : "Approve"}
                      </button>
                      <button
                        className={BTN_REJECT_RED}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUserReject(e, pendingUser);
                        }}
                        disabled={approvingInProgress || rejectingInProgress}
                      >
                        {rejectingInProgress ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const request = entry.record;
            const payload = request.payload || {};
            const productData = payload.productData || payload;
            const categoryLabel = payload.category_name || "—";
            const unitPrice = productData?.unit_price
              ? `₱ ${Number(productData.unit_price).toLocaleString()}`
              : "—";
            const unitCost = productData?.unit_cost
              ? `₱ ${Number(productData.unit_cost).toLocaleString()}`
              : "—";
            const quantityAdded = productData?.quantity_added ?? 0;
            const isHighlighted = highlightedInventoryIds.includes(
              request.pending_id
            );

            return (
              <div
                key={`inventory-${request.pending_id}`}
                ref={(node) => setPendingMobileRef(request.pending_id, node)}
                className={`bg-white border-2 border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                  isHighlighted
                    ? "border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.45)] animate-pulse"
                    : ""
                }`}
                onClick={() => openInventoryApprovalModal(request)}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    {/* title + Inventory Addition on the same top row */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="flex-1 font-semibold text-base sm:text-lg text-gray-900">
                        {productData?.product_name || "Unnamed Product"}
                      </h3>
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-xs px-3 py-1 border border-blue-200 whitespace-nowrap">
                        Inventory{" "}
                        {request.action_type === "update"
                          ? "Update"
                          : "Addition"}
                      </span>
                    </div>

                    {/* date under the title row */}
                    <span className="text-xs text-gray-500">
                      {formatDateTime(request.created_at)}
                    </span>

                    {/* status as a full-width bar */}
                    <span className="inline-flex w-full items-center justify-center rounded-lg bg-blue-100 px-3 py-2 text-[13px] leading-none font-semibold text-blue-700 border border-blue-200 text-center">
                      For Approval
                    </span>
                  </div>

                  <div className="space-y-2 text-sm border-t border-gray-200 pt-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="font-medium text-gray-700">
                        Branch:
                      </span>
                      <span className="text-gray-600">
                        {request.branch_name || "—"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="font-medium text-gray-700">
                        Requested By:
                      </span>
                      <span className="text-gray-600">
                        {request.created_by_name || "Inventory Staff"}
                      </span>
                    </div>
                    {request.manager_approver_name && (
                      <div className="flex flex-col gap-1 text-xs text-gray-500">
                        <span>
                          Forwarded by {request.manager_approver_name}
                        </span>
                        <span>
                          on {formatDateTime(request.manager_approved_at)}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                      <div>
                        <span className="font-medium text-gray-700">
                          Category:{" "}
                        </span>
                        <span className="text-gray-600">
                          {categoryLabel}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Quantity:{" "}
                        </span>
                        <span className="text-gray-600">
                          {quantityAdded}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Unit Price:{" "}
                        </span>
                        <span className="text-gray-600">
                          {unitPrice}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Unit Cost:{" "}
                        </span>
                        <span className="text-gray-600">
                          {unitCost}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-2">
                    <button
                      className={BTN_APPROVE_GREEN}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInventoryApprove(request.pending_id);
                      }}
                      disabled={processingInventoryId === request.pending_id}
                    >
                      {processingInventoryId === request.pending_id
                        ? "Processing..."
                        : "Approve"}
                    </button>
                      <button
                      className={BTN_REJECT_RED}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInventoryReject(request.pending_id);
                      }}
                      disabled={processingInventoryId === request.pending_id}
                    >
                      Reject
                    </button>
                      <button
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                        onClick={(e) => { e.stopPropagation(); handleInventoryRequestChanges(request.pending_id); }}
                        disabled={processingInventoryId === request.pending_id}
                      >
                        Request changes
                      </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <hr className="border-t-2 my-3 sm:my-4 w-full border-green-800 rounded-lg lg:hidden" />

      {/* User Information modal for pending user approvals */}
      <PendingUserApprovalModal
        open={userApprovalModalOpen}
        user={selectedPendingUser}
        onClose={closeUserApprovalModal}
        onApprove={handleModalApprove}
        onReject={handleModalReject}
        approving={
          !!selectedPendingUser &&
          Number(approvingUserId) === Number(selectedPendingUser.user_id)
        }
        rejecting={
          !!selectedPendingUser &&
          Number(rejectingUserId) === Number(selectedPendingUser.user_id)
        }
        formatDateTime={formatDateTime}
      />

      {/* Inventory Information modal for inventory approvals */}
      <PendingInventoryApprovalModal
        open={inventoryApprovalModalOpen}
        request={selectedInventoryRequest}
        onClose={closeInventoryApprovalModal}
        onApprove={handleModalInventoryApprove}
        onReject={handleModalInventoryReject}
        processing={
          !!selectedInventoryRequest &&
          processingInventoryId === selectedInventoryRequest.pending_id
        }
        formatDateTime={formatDateTime}
      />

      <RejectionReasonDialog
        open={rejectDialogOpen}
        onCancel={handleRejectDialogCancel}
        onConfirm={handleRejectDialogConfirm}
        sanitizeInput={sanitizeInput}
        title={
          rejectDialogContext.type === "user"
            ? "Reject User Account"
            : "Reject Inventory Request"
        }
        confirmLabel="Submit Rejection"
        zIndexClass="z-[10000]"
      />
    </div>
  );
}

function PendingUserApprovalModal({
  open,
  user,
  onClose,
  onApprove,
  onReject,
  approving,
  rejecting,
  formatDateTime,
}) {
  // lock scroll and handle back/escape while modal is open
  useModalLock(open, onClose);

  if (!open || !user) return null;

  // This modal is only for "for approval" accounts
  const isPending = true;

  // header + label colors (match PendingUserInfoModal for pending)
  const headerBgClass = "bg-amber-600";
  const headerTitle = "User Information – For Approval";
  const labelColorClass = "text-amber-700";

  // reconstruct names from object/full_name (same logic as UserManagement)
  let firstName =
    user.first_name || user.firstname || user.given_name || "";
  let lastName = user.last_name || user.lastname || user.surname || "";
  const fullName = user.full_name || "";

  if (!firstName && !lastName && fullName) {
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length > 1) {
      firstName = parts.slice(0, parts.length - 1).join(" ");
      lastName = parts[parts.length - 1];
    }
  }

  const branchName = user.branch_name || user.branch || "—";
  const roleLabel = Array.isArray(user.role)
    ? user.role.join(", ")
    : user.role || "—";

  const cellNumber =
    user.cell_number ||
    user.contact_number ||
    user.phone_number ||
    user.phone ||
    "—";

  const address = user.address || user.city || "—";

  const permissions =
    user.permissions_label ||
    (Array.isArray(user.permissions)
      ? user.permissions.join(", ")
      : user.permissions) ||
    "—";

  // For pending accounts we DON'T show a real hire date (same behavior you wanted)
  const hireDateRaw = null;
  const hireDate =
    hireDateRaw && typeof formatDateTime === "function"
      ? formatDateTime(hireDateRaw)
      : "—";

  const FieldCard = ({ label, children }) => (
    <div className="bg-white shadow-inner rounded-lg px-3 py-2 border border-gray-200 w-full h-full flex flex-col justify-center">
      <h2 className={`${labelColorClass} text-sm font-medium mb-1`}>
        {label}
      </h2>
      <div className="text-gray-800 text-base font-semibold break-words">
        {children}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] p-4 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose} // click outside closes modal
    >
      <div
        className="bg-white rounded-lg shadow-2xl border border-green-100 w-full max-w-[900px] max-h-[90vh] flex flex-col overflow-hidden animate-popup"
        onClick={(e) => e.stopPropagation()} // prevent outside close when clicking inside
      >
        {/* Header (same style as PendingUserInfoModal, but amber for pending) */}
        <div
          className={`${headerBgClass} p-4 rounded-t-lg flex justify-between items-center gap-3 flex-shrink-0 sticky top-0 z-10`}
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-white font-bold text-base lg:text-2xl">
              {headerTitle}
            </h1>
            {isPending && (
              <span className="inline-flex items-center rounded-full bg-amber-100/90 text-amber-800 text-xs font-semibold px-3 py-1">
                This account is awaiting owner approval
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-white hover:bg-black/10 p-1.5 rounded-lg"
            aria-label="Close"
            title="Close"
          >
            <IoMdClose className="text-2xl" />
          </button>
        </div>

        {/* Body (same grid style as UserManagement modal) */}
        <div className="flex-1 overflow-y-auto p-5 bg-green-50/30 hide-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 auto-rows-fr">
            <FieldCard label="First Name">{firstName || "—"}</FieldCard>
            <FieldCard label="Last Name">{lastName || "—"}</FieldCard>

            <FieldCard label="Branch">{branchName}</FieldCard>
            <FieldCard label="Role">{roleLabel}</FieldCard>

            <FieldCard label="Cell Number">{cellNumber}</FieldCard>
            <FieldCard label="Address">{address}</FieldCard>

            <FieldCard label="Permissions">
              {permissions || "—"}
            </FieldCard>
            <FieldCard label="Hire Date">{hireDate}</FieldCard>

            <FieldCard label="Account Status">
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 border border-amber-200">
                For Approval
              </span>
            </FieldCard>
            <div className="hidden md:block" />
          </div>
        </div>

        {/* Footer – Approve / Reject buttons (kept from your original Approvals modal) */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onApprove}
            disabled={approving || rejecting}
            className="px-8 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-60"
          >
            {approving ? "Approving…" : "Approve"}
          </button>

          <button
            onClick={onReject}
            disabled={rejecting || approving}
            className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-60"
          >
            {rejecting ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingInventoryApprovalModal({
  open,
  request,
  onClose,
  onApprove,
  onReject,
  processing,
  formatDateTime, // not used directly but kept for signature consistency
}) {
  // lock scroll + Esc/back when modal is open
  useModalLock(open, onClose);

  if (!open || !request) return null;

  const payload = request.payload || {};
  const productData = payload.productData || payload;

  // === Map fields to match your product form ===
  const productName =
    productData.product_name || productData.name || "Unnamed Product";

  const description =
    productData.description ||
    productData.product_description ||
    payload.description ||
    "—";

  const categoryLabel =
    payload.category_name ||
    productData.category_name ||
    productData.category ||
    "—";

  const unitLabel =
    productData.unit_name ||
    productData.unit ||
    payload.unit_name ||
    payload.unit ||
    "—";

  const minThreshold =
    productData.min_threshold ?? productData.min_stock ?? "—";

  const maxThreshold =
    productData.max_threshold ?? productData.max_stock ?? "—";

  const quantity =
    productData.quantity ?? productData.quantity_added ?? null;

  const unitCost =
    productData.unit_cost != null
      ? `₱ ${Number(productData.unit_cost).toLocaleString()}`
      : "—";

  const price =
    productData.unit_price != null
      ? `₱ ${Number(productData.unit_price).toLocaleString()}`
      : "—";

  const dateAddedRaw =
    productData.date_added ||
    productData.created_at ||
    request.created_at ||
    null;

  const validityRaw =
    productData.product_validity ||
    productData.expiry_date ||
    payload.expiry_date ||
    null;

  const branchName = request.branch_name || "—";
  const createdBy = request.created_by_name || "Inventory Staff";

  const requestType =
    request.action_type === "update"
      ? "Inventory Update"
      : "Inventory Addition";

  // Date-only formatter (MM/DD/YYYY style)
  const formatDateOnly = (value) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return String(value);
    }
  };

  const dateAdded = formatDateOnly(dateAddedRaw);
  const validityDate = formatDateOnly(validityRaw);

  const FieldCard = ({ label, children, className = "" }) => (
    <div
      className={
        "bg-white shadow-inner rounded-lg px-3 py-2 border border-gray-200 w-full h-full flex flex-col justify-center " +
        className
      }
    >
      <h2 className="text-emerald-700 text-sm font-medium mb-1">
        {label}
      </h2>
      <div className="text-gray-800 text-base font-semibold break-words">
        {children}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[9998] p-4 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl border border-green-100 w-full max-w-[900px] max-h-[90vh] flex flex-col overflow-hidden animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header – green theme */}
        <div className="bg-green-700 p-4 rounded-t-lg flex justify-between items-center gap-3 flex-shrink-0 sticky top-0 z-10">
          <div className="flex flex-col gap-1">
            <h1 className="text-white font-bold text-base lg:text-2xl">
              Inventory Information – For Approval
            </h1>
            <span className="inline-flex items-center rounded-full bg-emerald-100/90 text-emerald-900 text-xs font-semibold px-3 py-1">
              This inventory request is awaiting owner approval
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-white hover:bg-black/10 p-1.5 rounded-lg"
            aria-label="Close"
            title="Close"
          >
            <IoMdClose className="text-2xl" />
          </button>
        </div>

        {/* Body – layout mirrors the product form */}
        <div className="flex-1 overflow-y-auto p-5 bg-green-50/30 hide-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-fr">
            {/* Product name – full width */}
            <FieldCard
              label="Product Name"
              className="md:col-span-12"
            >
              {productName}
            </FieldCard>

            {/* Description – full width */}
            <FieldCard
              label="Description"
              className="md:col-span-12"
            >
              {description}
            </FieldCard>

            {/* Category / Unit – 50 / 50 */}
            <FieldCard label="Category" className="md:col-span-6">
              {categoryLabel}
            </FieldCard>
            <FieldCard label="Unit" className="md:col-span-6">
              {unitLabel}
            </FieldCard>

            {/* Min / Max threshold / Quantity – 25 / 25 / 50 (like your form) */}
            <FieldCard
              label="Min Threshold"
              className="md:col-span-3"
            >
              {minThreshold}
            </FieldCard>
            <FieldCard
              label="Max Threshold"
              className="md:col-span-3"
            >
              {maxThreshold}
            </FieldCard>
            <FieldCard label="Quantity" className="md:col-span-6">
              {quantity}
            </FieldCard>

            {/* Unit cost / Price – 50 / 50 */}
            <FieldCard label="Unit Cost" className="md:col-span-6">
              {unitCost}
            </FieldCard>
            <FieldCard label="Price" className="md:col-span-6">
              {price}
            </FieldCard>

            {/* Date Added / Product Validity – 50 / 50 */}
            <FieldCard
              label="Enter Date Added"
              className="md:col-span-6"
            >
              {dateAdded}
            </FieldCard>
            <FieldCard
              label="Enter Product Validity"
              className="md:col-span-6"
            >
              {validityDate}
            </FieldCard>

            {/* Branch / Requested By – 50 / 50 */}
            <FieldCard label="Branch" className="md:col-span-6">
              {branchName}
            </FieldCard>
            <FieldCard label="Requested By" className="md:col-span-6">
              {createdBy}
            </FieldCard>

            {/* Status / Request Type – 50 / 50 */}
            <FieldCard label="Status" className="md:col-span-6">
              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 border border-emerald-200">
                For Approval
              </span>
            </FieldCard>
            <FieldCard
              label="Request Type"
              className="md:col-span-6"
            >
              {requestType}
            </FieldCard>
          </div>
        </div>

        {/* Footer – Approve / Reject buttons */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onApprove}
            disabled={processing}
            className="px-8 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-60"
          >
            {processing ? "Processing…" : "Approve"}
          </button>

          <button
            onClick={onReject}
            disabled={processing}
            className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default Approvals;
