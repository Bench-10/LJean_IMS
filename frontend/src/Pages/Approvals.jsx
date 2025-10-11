import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChartLoading from "../components/common/ChartLoading";
import NoInfoFound from "../components/common/NoInfoFound";

function Approvals({ users = [], usersLoading = false, approvePendingAccount, sanitizeInput }) {
  const [searchItem, setSearchItem] = useState("");
  const [approvingUserId, setApprovingUserId] = useState(null);
  const navigate = useNavigate();

  const handleSearch = (event) => {
    if (!sanitizeInput) {
      setSearchItem(event.target.value);
      return;
    }
    setSearchItem(sanitizeInput(event.target.value));
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

  return (
    <div className="ml-[220px] px-8 py-2 max-h-screen">
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
      </div>

      <hr className="border-t-2 my-6 w-full border-gray-300" />

      <div className="overflow-x-auto overflow-y-auto h-[600px] border border-gray-200 rounded-sm shadow-sm bg-white">
        <table className={`w-full ${pendingUsers.length === 0 ? "h-full" : ""} divide-y divide-gray-200 text-sm`}>
          <thead className="sticky top-0 bg-green-500 text-white z-10">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium w-48">Branch</th>
              <th className="px-4 py-3 text-left font-medium w-48">Requested Roles</th>
              <th className="px-4 py-3 text-left font-medium w-40">Requested By</th>
              <th className="px-4 py-3 text-center font-medium w-40">Status</th>
              <th className="px-4 py-3 text-center font-medium w-52">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {usersLoading ? (
              <tr>
                <td colSpan={6}>
                  <ChartLoading message="Loading pending approvals..." />
                </td>
              </tr>
            ) : pendingUsers.length === 0 ? (
              <NoInfoFound col={6} message="No pending approvals at the moment." />
            ) : (
              pendingUsers.map((pendingUser) => {
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
                    key={pendingUser.user_id}
                    className="h-16 border-b last:border-b-0 hover:bg-amber-50 transition-colors"
                    onClick={() => navigate(`/user_management?selected=${pendingUser.user_id}`)}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {pendingUser.full_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{pendingUser.branch}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rolesLabel}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {creatorName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-4 py-1 text-sm font-semibold text-amber-700 border border-amber-300">
                        For Approval
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Approvals;
