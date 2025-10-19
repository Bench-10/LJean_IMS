import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChartLoading from "../components/common/ChartLoading";
import NoInfoFound from "../components/common/NoInfoFound";
import RejectionReasonDialog from "../components/dialogs/RejectionReasonDialog";

function Approvals({
  users = [],
  usersLoading = false,
  approvePendingAccount,
  sanitizeInput,
  inventoryRequests = [],
  inventoryRequestsLoading = false,
  approveInventoryRequest,
  rejectInventoryRequest,
  refreshInventoryRequests
}) {
  const [searchItem, setSearchItem] = useState("");
  const [approvingUserId, setApprovingUserId] = useState(null);
  const [processingInventoryId, setProcessingInventoryId] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [pendingRejectId, setPendingRejectId] = useState(null);
  const navigate = useNavigate();

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
        minute: "2-digit"
      });
    } catch (error) {
      return value;
    }
  };

  const pendingUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];

    const normalizedSearch = searchItem.toLowerCase();

    return users
      .filter((user) => user.status === "pending")
      .filter((user) => {
        if (!normalizedSearch) return true;

        const nameMatch = user.full_name?.toLowerCase().includes(normalizedSearch);
        const branchMatch = user.branch?.toLowerCase().includes(normalizedSearch);
        const roleMatch = Array.isArray(user.role)
          ? user.role.join(", ").toLowerCase().includes(normalizedSearch)
          : String(user.role ?? "").toLowerCase().includes(normalizedSearch);

        return nameMatch || branchMatch || roleMatch;
      });
  }, [users, searchItem]);

  const handleApprove = async (event, pendingUser) => {
    event.stopPropagation();
    if (!approvePendingAccount) return;

    try {
      setApprovingUserId(pendingUser.user_id);
      await approvePendingAccount(pendingUser.user_id);
    } catch (error) {
      console.error("Error approving user:", error);
    } finally {
      setApprovingUserId(null);
    }
  };

  const pendingInventoryRequests = useMemo(() => {
    if (!Array.isArray(inventoryRequests)) return [];

    const normalizedSearch = searchItem.toLowerCase();

    return inventoryRequests
      .filter((request) => request.current_stage === "admin_review" && request.status === "pending")
      .filter((request) => {
        if (!normalizedSearch) return true;

        const payload = request.payload || {};
        const productData = payload.productData || payload;

        const productNameMatch = productData?.product_name?.toLowerCase().includes(normalizedSearch);
        const branchMatch = request.branch_name?.toLowerCase().includes(normalizedSearch);
        const creatorMatch = request.created_by_name?.toLowerCase().includes(normalizedSearch);

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
      kind: 'user',
      createdAt: record.created_at ?? record.createdAt ?? null,
      record
    }));

    const inventoryEntries = pendingInventoryRequests.map((record) => ({
      kind: 'inventory',
      createdAt: record.created_at ?? null,
      record
    }));

    return [...userEntries, ...inventoryEntries].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
  }, [pendingUsers, pendingInventoryRequests]);

  const combinedLoading = usersLoading || inventoryRequestsLoading;

  const handleInventoryApprove = async (pendingId) => {
    if (!approveInventoryRequest) return;

    try {
      setProcessingInventoryId(pendingId);
      await approveInventoryRequest(pendingId);
    } catch (error) {
      console.error("Error approving inventory request:", error);
    } finally {
      setProcessingInventoryId(null);
    }
  };

  const handleInventoryReject = (pendingId) => {
    if (!rejectInventoryRequest) return;

    setPendingRejectId(pendingId);
    setRejectDialogOpen(true);
  };

  const handleRejectDialogCancel = () => {
    setRejectDialogOpen(false);
    setPendingRejectId(null);
  };

  const handleRejectDialogConfirm = async (reason) => {
    if (!rejectInventoryRequest || pendingRejectId === null) {
      handleRejectDialogCancel();
      return;
    }

    try {
      setProcessingInventoryId(pendingRejectId);
      await rejectInventoryRequest(pendingRejectId, reason);
    } catch (error) {
      console.error("Error rejecting inventory request:", error);
    } finally {
      setProcessingInventoryId(null);
      handleRejectDialogCancel();
    }
  };

  return (
    <div className="pt-20 lg:pt-8 px-4 lg:px-8 pb-6 h-screen">
      <h1 className="text-4xl font-bold text-green-900">APPROVAL CENTER</h1>
      <hr className="mt-4 mb-6 border-t-4 border-green-800" />

      <div className="flex w-full flex-col gap-4 md:flex-row md:items-center">
        <div className="w-full md:w-[360px]">
          <input
            type="text"
            placeholder="Search pending request by name, branch, or role"
            className="border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-11"
            onChange={handleSearch}
            value={searchItem}
          />
        </div>
        {typeof refreshInventoryRequests === "function" && (
          <div className="md:ml-auto">
            <button
              className="px-4 py-2 text-sm border border-amber-500 text-amber-600 rounded-md hover:bg-amber-100"
              onClick={refreshInventoryRequests}
            >
              Refresh inventory approvals
            </button>
          </div>
        )}
      </div>

      <hr className="border-t-2 my-6 w-full border-gray-300" />

      <div className="overflow-x-auto overflow-y-auto h-[600px] border border-gray-200 rounded-sm shadow-sm bg-white">
        <table className={`w-full ${combinedRequests.length === 0 ? "h-full" : ""} divide-y divide-gray-200 text-sm`}>
          <thead className="sticky top-0 bg-green-500 text-white z-10">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Request</th>
              <th className="px-4 py-3 text-left font-medium w-48">Branch</th>
              <th className="px-4 py-3 text-left font-medium w-56">Requested By</th>
              <th className="px-4 py-3 text-left font-medium w-64">Details</th>
              <th className="px-4 py-3 text-center font-medium w-40">Status</th>
              <th className="px-4 py-3 text-center font-medium w-56">Actions</th>
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
              <NoInfoFound col={6} message="No pending approvals at the moment." />
            ) : (
              combinedRequests.map((entry) => {
                if (entry.kind === 'user') {
                  const pendingUser = entry.record;
                  const rolesLabel = Array.isArray(pendingUser.role)
                    ? pendingUser.role.join(", ")
                    : pendingUser.role ?? "";

                  const creatorName = pendingUser.created_by_name
                    || (() => {
                      if (!pendingUser.created_by) return "Branch Manager";
                      const creator = Array.isArray(users)
                        ? users.find((user) => user.user_id === pendingUser.created_by)
                        : null;
                      return creator?.full_name || "Branch Manager";
                    })();

                  return (
                    <tr
                      key={`user-${pendingUser.user_id}`}
                      className="h-20 border-b last:border-b-0 hover:bg-amber-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/user_management?selected=${pendingUser.user_id}`)}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-gray-800 text-base">{pendingUser.full_name}</span>
                          <span className="inline-flex w-max items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 border border-emerald-200">
                            User Account Approval
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap align-top">{pendingUser.branch || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap align-top">{creatorName}</td>
                      <td className="px-4 py-3 text-gray-700 align-top">
                        <span className="text-sm">Roles: {rolesLabel || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-4 py-1 text-sm font-semibold text-amber-700 border border-amber-300">
                          For Approval
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <button
                          className="py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-md w-auto disabled:opacity-70 disabled:cursor-not-allowed"
                          onClick={(e) => handleApprove(e, pendingUser)}
                          disabled={approvingUserId === pendingUser.user_id}
                        >
                          {approvingUserId === pendingUser.user_id ? "Approving..." : "Approve account"}
                        </button>
                      </td>
                    </tr>
                  );
                }

                const request = entry.record;
                const payload = request.payload || {};
                const productData = payload.productData || payload;
                const categoryLabel = payload.category_name || '—';
                const unitPrice = productData?.unit_price ? `₱ ${Number(productData.unit_price).toLocaleString()}` : '—';
                const unitCost = productData?.unit_cost ? `₱ ${Number(productData.unit_cost).toLocaleString()}` : '—';
                const quantityAdded = productData?.quantity_added ?? 0;

                return (
                  <tr
                    key={`inventory-${request.pending_id}`}
                    className="h-20 border-b last:border-b-0 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-800 text-base">{productData?.product_name || 'Unnamed Product'}</span>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-700 font-semibold px-3 py-1 border border-blue-200">
                            Inventory {request.action_type === 'update' ? 'Update' : 'Addition'}
                          </span>
                          <span className="text-gray-500">Submitted {formatDateTime(request.created_at)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap align-top">{request.branch_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 align-top">
                      <div className="flex flex-col gap-1">
                        <span>{request.created_by_name || 'Inventory Staff'}</span>
                        {request.manager_approver_name && (
                          <span className="text-xs text-gray-500">Forwarded by {request.manager_approver_name} on {formatDateTime(request.manager_approved_at)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 align-top">
                      <div className="text-sm space-y-1">
                        <p>Category: {categoryLabel}</p>
                        <p>Quantity Added: {quantityAdded}</p>
                        <p>Unit Price: {unitPrice}</p>
                        <p>Unit Cost: {unitCost}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-top">
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-4 py-1 text-sm font-semibold text-blue-700 border border-blue-200">
                        Awaiting Owner Approval
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center align-top">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-70 disabled:cursor-not-allowed"
                          onClick={() => handleInventoryApprove(request.pending_id)}
                          disabled={processingInventoryId === request.pending_id}
                        >
                          {processingInventoryId === request.pending_id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-70 disabled:cursor-not-allowed"
                          onClick={() => handleInventoryReject(request.pending_id)}
                          disabled={processingInventoryId === request.pending_id}
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
      <RejectionReasonDialog
        open={rejectDialogOpen}
        onCancel={handleRejectDialogCancel}
        onConfirm={handleRejectDialogConfirm}
        sanitizeInput={sanitizeInput}
        title="Reject Inventory Request"
        confirmLabel="Submit Rejection"
      />
    </div>
  );
}

export default Approvals;
