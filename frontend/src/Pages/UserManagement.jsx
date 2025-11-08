import { MdGroupAdd } from "react-icons/md";
import NoInfoFound from "../components/common/NoInfoFound";
import { useState, useMemo } from "react";
import DropdownCustom from "../components/DropdownCustom";
import { useNavigate } from "react-router-dom";
import { MdOutlineDesktopAccessDisabled, MdOutlineDesktopWindows } from "react-icons/md";
import EnableDisableAccountDialog from "../components/dialogs/EnableDisableAccountDialog";
import ChartLoading from "../components/common/ChartLoading";


function UserManagement({handleUserModalOpen, users, user, setOpenUsers, setUserDetailes, sanitizeInput, disableEnableAccount, usersLoading}) {

  const [searchItem, setSearchItem] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [openAccountStatusDialog, setOpenAccountStatusDialog] = useState(false);
  const [userStatus, setUserStatus] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const navigate = useNavigate();

  const isOwnerUser = user && user.role && user.role.some(role => ['Owner'].includes(role));
  const isAdmin = user && user.role && user.role.some(role => ['Owner', 'Admin'].includes(role));
  
  const handleSearch = (event) =>{
    setSearchItem(sanitizeInput(event.target.value));
  }

  const filteredUserData = users.filter((user) => 
    (
      user.full_name.toLowerCase().includes(searchItem.toLowerCase()) || 
      user.branch.toLowerCase().includes(searchItem.toLowerCase()) ||
      (user.status ? user.status.toLowerCase().includes(searchItem.toLowerCase()) : false)
    )
    && (selectedBranch === '' || (user.branch && user.branch.toLowerCase() === selectedBranch.toLowerCase()))
  );

  const branchOptions = useMemo(() => {
    const branches = Array.from(new Set(users.filter(u => u && u.branch).map(u => u.branch)));
    const opts = [{ value: '', label: 'All Branches' }, ...branches.map(b => ({ value: b, label: b }))];
    return opts;
  }, [users]);

  const getStatusBadge = (row) => {
    if (row.status === 'pending') {
      return {
        label: 'For Approval',
        className: 'bg-amber-100 text-amber-700 border border-amber-300'
      };
    }

    if (row.is_disabled) {
      return {
        label: 'Disabled',
        className: 'bg-red-400 text-red-800'
      };
    }

    if (row.is_active) {
      return {
        label: 'Active',
        className: 'bg-[#61E85C] text-green-700'
      };
    }

    return {
      label: 'Inactive',
      className: 'bg-gray-200 text-gray-500'
    };
  };

  return (
    <div className='pt-20 lg:pt-8 px-4 lg:px-8 pb-6 min-h-screen'>

      {openAccountStatusDialog && 
        <EnableDisableAccountDialog
          onClose={() => setOpenAccountStatusDialog(false)}
          status={userStatus}
          action={async () => {
            try {
              setIsProcessing(true);
              await disableEnableAccount(userInfo);
              setOpenAccountStatusDialog(false);
            } catch (err) {
              console.error('Enable/Disable action failed', err);
            } finally {
              setIsProcessing(false);
            }
          }}
          loading={isProcessing}
        />
      }

      {/*TITLE*/}
      <h1 className='text-2xl md:text-[33px] leading-[36px] font-bold text-green-900'>
        USER MANAGEMENT
      </h1>

      <hr className="mt-3 mb-6 border-t-4 border-green-800"/>

      {/*SEARCH AND ADD*/}
<div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full">

  {/* Left: Search + Branch beside each other on desktop */}
  <div className="flex flex-col text-sm sm:flex-row sm:items-center sm:gap-3 w-full lg:w-auto">
    {/* Search Field */}
    <input
      type="text"
      placeholder="Search Employee Name or Role"
      className="w-full sm:w-[430px] h-[35px] border outline outline-1 outline-gray-400 
                 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all 
                 px-3 rounded-lg mb-2 sm:mb-0"
      onChange={handleSearch}
    />

    {/* Branch Dropdown */}
    {isAdmin && (
      <div className="w-full sm:w-[220px]">
        <DropdownCustom
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          options={branchOptions}
          variant="simple"
        />
      </div>
    )}
  </div>

  {/* Right: Add User Button */}
  <button
    className="w-full lg:w-auto inline-flex items-center justify-center border 
               bg-[#119200] font-medium hover:bg-[#56be48] text-white px-5 py-2 
               rounded-lg transition-all text-sm whitespace-nowrap"
    onClick={() => handleUserModalOpen('add')}
  >
    <MdGroupAdd className="mr-2" />
    ADD NEW USER
  </button>
</div>



      <hr className="border-t-2 my-4 w-full border-gray-500"/>

      {/*DESKTOP TABLE */}
      <div className="hidden md:block overflow-x-auto overflow-y-auto h-[55vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6">
        <table className={`w-full ${filteredUserData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200 text-sm`}>
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white">
                NAME
              </th>

              {isOwnerUser && 
                <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-52">
                  BRANCH
                </th>
              }
              
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-52">
                ROLE
              </th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-44">
                CELL NUMBER
              </th>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-36">
                STATUS
              </th>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-48">
                ACTION
              </th>
            </tr>
          </thead>

          <tbody className="bg-white relative">
            {usersLoading ? 
              (
                <tr>
                  <td colSpan={10}>
                    <ChartLoading message="Loading users..."/>
                  </td>
                </tr>
              )
              :
              (filteredUserData.length === 0 ? 
                (
                  <NoInfoFound col={10}/>
                ) : 
                (
                  filteredUserData.map((row, rowIndex) => {
                    const rowBaseClass = row.is_disabled
                      ? 'h-14 bg-red-200 text-red-900 cursor-pointer'
                      : row.status === 'pending'
                        ? 'h-14 bg-amber-50 hover:bg-amber-100 cursor-pointer'
                        : `h-14 ${((rowIndex + 1) % 2 === 0 ? 'bg-[#F6F6F6]' : '')} hover:bg-gray-200/70 cursor-pointer`;

                    const statusBadge = getStatusBadge(row);

                    return (
                      <tr key={rowIndex} className={rowBaseClass} onClick={() => {row.status === 'pending' ? '' : setOpenUsers(true); setUserDetailes(row);}} >
                        <td className="px-4 py-2">{row.full_name}</td>
                        {isOwnerUser && 
                          <td className="px-4 py-2 font-medium whitespace-nowrap">{row.branch}</td>
                        }
                        <td className="px-4 py-2 whitespace-nowrap">
                          {Array.isArray(row.role)
                            ? (row.role.length > 1
                              ? row.role.join(", ")
                              : row.role[0] || "")
                            : row || ""}
                        </td>
                        <td className="px-4 py-2">{row.cell_number}</td>
                        <td className="px-4 py-2 text-center align-middle">
                          <div className={`mx-auto text-center font-semibold w-32 rounded-full px-5 py-1 ${statusBadge.className}`}>
                            {statusBadge.label}
                          </div>
                        </td>

                        <td className="text-center align-middle">
                          {row.status === 'pending' ? (
                            isOwnerUser ? (
                              <button
                                className="py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white w-auto rounded-md flex items-center justify-center gap-2 mx-auto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/approvals');
                                }}
                              >
                                Manage approvals
                              </button>
                            ) : (
                              <span className="text-sm font-semibold text-amber-600">Awaiting owner approval</span>
                            )
                          ) : (
                            <button
                              className={`py-2 px-4 ${row.is_disabled ? 'bg-green-500 text-white':'bg-gray-300 text-gray-500'} w-auto rounded-lg flex items-center justify-center gap-2 mx-auto`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserStatus(row.is_disabled);
                                setUserInfo(row);
                                setOpenAccountStatusDialog(true);
                              }}
                            >
                              {row.is_disabled ? <MdOutlineDesktopWindows /> : <MdOutlineDesktopAccessDisabled />}
                              {row.is_disabled ? "Enable account" : "Disable account"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              )
            }
          </tbody>
        </table>
      </div>

      {/*MOBILE CARD VIEW*/}
      <div className="md:hidden space-y-4 overflow-y-auto max-h-[60vh] pb-6 hide-scrollbar">
        {usersLoading ? (
          <ChartLoading message="Loading users..."/>
        ) : filteredUserData.length === 0 ? (
          <NoInfoFound col={1} isTable={false} />
        ) : (
          filteredUserData.map((row, rowIndex) => {
            const statusBadge = getStatusBadge(row);
            const cardBaseClass = row.is_disabled
              ? 'bg-red-200 border-red-400'
              : row.status === 'pending'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-white border-gray-200';

            return (
              <div 
                key={rowIndex} 
                className={`border-2 ${cardBaseClass} rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => {row.status === 'pending' ? '' : setOpenUsers(true); setUserDetailes(row);}}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-900">{row.full_name}</h3>
                  <div className={`text-xs font-semibold rounded-full px-3 py-1 ${statusBadge.className}`}>
                    {statusBadge.label}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {isOwnerUser && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">Branch:</span>
                      <span className="text-gray-900">{row.branch}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Role:</span>
                    <span className="text-gray-900">
                      {Array.isArray(row.role)
                        ? (row.role.length > 1
                          ? row.role.join(", ")
                          : row.role[0] || "")
                        : row || ""}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Cell Number:</span>
                    <span className="text-gray-900">{row.cell_number}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200">
                  {row.status === 'pending' ? (
                    isOwnerUser ? (
                      <button
                        className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-md flex items-center justify-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/approvals');
                        }}
                      >
                        Manage approvals
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-amber-600 block text-center">Awaiting owner approval</span>
                    )
                  ) : (
                    <button
                      className={`w-full py-2 px-4 ${row.is_disabled ? 'bg-green-500 text-white':'bg-gray-300 text-gray-500'} rounded-md flex items-center justify-center gap-2`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserStatus(row.is_disabled);
                        setUserInfo(row);
                        setOpenAccountStatusDialog(true);
                      }}
                    >
                      {row.is_disabled ? <MdOutlineDesktopWindows /> : <MdOutlineDesktopAccessDisabled />}
                      {row.is_disabled ? "Enable account" : "Disable account"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <hr className="mt-3 mb-6 border-t-2 border-green-800 rounded-lg"/>
      </div>
    </div>
  );
}

export default UserManagement
