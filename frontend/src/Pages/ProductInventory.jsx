import React, { useState, useEffect } from 'react';
import NoInfoFound from '../components/common/NoInfoFound.jsx';
import InAppNotificationPopUp from '../components/dialogs/InAppNotificationPopUp.jsx';
import { TbFileExport } from "react-icons/tb";
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
  openInAppNotif,
  mode,
  message,
  invetoryLoading,
  pendingRequests = [],
  pendingRequestsLoading = false,
  approvePendingRequest,
  rejectPendingRequest,
  refreshPendingRequests
}) {

  const { user } = useAuth();
  const [error, setError] = useState();
  const [searchItem, setSearchItem] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(() => user && user.role && user.role.some(role => ['Branch Manager'].includes(role)) ? user.branch_id : '');
  const [isPendingDialogOpen, setIsPendingDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [pendingRejectId, setPendingRejectId] = useState(null);

  const displayPendingApprovals = user && user.role && user.role.some(role => ['Branch Manager'].includes(role));

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
    if (typeof approvePendingRequest === 'function') {
      approvePendingRequest(pendingId);
    }
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
    if (typeof rejectPendingRequest === 'function' && pendingRejectId !== null) {
      rejectPendingRequest(pendingRejectId, reason);
    }
    setIsRejectDialogOpen(false);
    setPendingRejectId(null);
  };

  // NEW: DIALOG STATE
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Show 50 items per page

  const handleSearch = (event) => {
    setSearchItem(sanitizeInput(event.target.value));
    setCurrentPage(1); // Reset to first page when searching
  }

  // RESET PAGINATION WHEN FILTERS CHANGE
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedBranch]);

  // OPEN DETAILS DIALOG ON ROW CLICK
  const openDetails = (item) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedItem(null);
  };


  //CONTAINS ALL AVAILABLE PRODUCTS WHEN LOADED
  let filteredProducts = productsData;

  //FILTER BY CATEGORY
  filteredProducts = selectedCategory
    ? filteredProducts.filter(item => item.category_id === Number(selectedCategory))
    : filteredProducts;

  //FILTER BY BRANCH
  filteredProducts = selectedBranch
    ? filteredProducts.filter(item => item.branch_id === Number(selectedBranch))
    : filteredProducts;



  //FILTER BY SEARCH
  const filteredData = filteredProducts.filter(product =>
    product.product_name.toLowerCase().includes(searchItem.toLowerCase())

  );

  // PAGINATION LOGIC
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  // EXPORT FUNCTIONALITY
  const handleExportInventory = (format) => {
    const exportData = formatForExport(filteredData, ['product_id']);
    const filename = `inventory_export_${new Date().toISOString().split('T')[0]}`;

    const customHeaders = ['Product Name', 'Category', 'Unit', 'Stock Quantity', 'Price', 'Threshold'];
    const dataKeys = ['product_name', 'category_name', 'unit', 'quantity', 'unit_price', 'min_threshold'];

    if (format === 'csv') {
      exportToCSV(exportData, filename, customHeaders, dataKeys);
    } else if (format === 'pdf') {
      exportToPDF(exportData, filename, {
        title: 'Product Inventory Report',
        customHeaders: customHeaders,
        dataKeys: dataKeys,
        showCategorySummary: exportData.length > 0 && !!exportData[0].category_name
      });
    }
  };


  return (

    <div className="pt-20 lg:pt-8 px-4 lg:px-8 pb-6 h-screen">

      {openInAppNotif &&
        <InAppNotificationPopUp
          title={mode}
          message={message}

        />
      }


      {/*REJECTION REASON */}
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

      <div className='flex items-center justify-between'>
        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          INVENTORY
        </h1>


      </div>

      <hr className="mt-3 mb-6 border-t-4 border-green-800 rounded-lg" />


      {displayPendingApprovals && isPendingDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b  rounded-t-lg">
              <div>
                <h2 className="text-lg font-semibold">Pending Inventory Requests</h2>
                <p className="text-sm">Review inventory additions or updates awaiting your approval.</p>
              </div>
              <div className="flex items-center gap-2">
                {typeof refreshPendingRequests === 'function' && (
                  <button
                    className="px-3 py-1.5 text-sm border border-amber-500 text-amber-600 rounded-md hover:bg-amber-100"
                    onClick={refreshPendingRequests}
                  >
                    Refresh
                  </button>
                )}
                <button
                  className="w-8 h-8 flex items-center justify-center text-2xl border-none bg-transparent p-0"
                  style={{ boxShadow: 'none', outline: 'none', background: 'none', border: 'none' }}
                  onClick={() => setIsPendingDialogOpen(false)}
                  aria-label="Close"
                >
                  &#10005;
                </button>
              </div>
            </div>

            <div className="min-h-40 max-h-[70vh] overflow-y-auto px-5 py-4">
              {pendingRequestsLoading ? (
                <div className="py-10">
                  <ChartLoading message="Loading pending inventory approvals..." />
                </div>
              ) : (pendingRequests?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <FaBoxOpen className='text-5xl opacity-50' />
                  <p className="text-sm italic text-center mt-2">No pending requests at the moment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(request => {
                    const { payload } = request;
                    const requestedProduct = payload?.productData || payload;
                    const currentState = payload?.currentState;

                    return (
                      <div key={request.pending_id} className="border bg-white rounded-md p-4 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-1 relative">
                            <div className="absolute top-0 right-0 flex gap-2">
                              <button
                                className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                                onClick={() => handleApproveClick(request.pending_id)}
                              >
                                Approve & Apply
                              </button>
                              <button
                                className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600"
                                onClick={() => handleRejectClick(request.pending_id)}
                              >
                                Reject
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="uppercase text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                {request.action_type === 'update' ? 'Update' : 'Add'}
                              </span>
                              <span className="text-xs text-gray-500">Requested {formatDateTime(request.created_at)}</span>
                              {request.requires_admin_review && (
                                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                  Owner approval required
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mt-1">
                              {requestedProduct?.product_name || 'Unnamed Product'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Submitted by {request.created_by_name || 'Inventory Staff'}
                            </p>

                            <div className="mt-3 flex flex-col md:flex-row gap-3 text-sm w-full">
                              <div className="bg-amber-100/60 border border-amber-200 rounded-md p-3 w-full md:w-1/2">
                                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Requested Update</p>
                                <ul className="space-y-1 text-amber-900">
                                  {requestedProduct?.quantity_added !== undefined && (
                                    <li>
                                      <span className="font-medium">Quantity:</span>{' '}
                                      {currentState ? `${Number(currentState.quantity).toLocaleString()} + ` : ''}
                                      <span className='font-bold'>{requestedProduct.quantity_added}</span>{' '}
                                      {requestedProduct.unit ?? ''}
                                    </li>
                                  )}
                                  {requestedProduct?.unit_price !== undefined && (
                                    <li><span className="font-medium">Unit Price:</span> ₱ {Number(requestedProduct.unit_price).toLocaleString()}</li>
                                  )}
                                  {requestedProduct?.unit_cost !== undefined && (
                                    <li><span className="font-medium">Unit Cost:</span> ₱ {Number(requestedProduct.unit_cost).toLocaleString()}</li>
                                  )}
                                  {requestedProduct?.min_threshold !== undefined && requestedProduct?.max_threshold !== undefined && (
                                    <li><span className="font-medium">Threshold:</span> {requestedProduct.min_threshold} - {requestedProduct.max_threshold}</li>
                                  )}
                                  {requestedProduct?.product_validity && (
                                    <li><span className="font-medium">Validity:</span> {requestedProduct.product_validity}</li>
                                  )}
                                </ul>
                              </div>

                              {currentState && (
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 w-full md:w-1/2">
                                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Current Values</p>
                                  <ul className="space-y-1 text-gray-700">
                                    <li><span className="font-medium">Quantity:</span> {Number(currentState.quantity).toLocaleString()} {currentState.unit}</li>
                                    <li><span className="font-medium">Unit Price:</span> ₱ {Number(currentState.unit_price).toLocaleString()}</li>
                                    <li><span className="font-medium">Unit Cost:</span> ₱ {Number(currentState.unit_cost).toLocaleString()}</li>
                                    <li><span className="font-medium">Threshold:</span> {currentState.min_threshold} - {currentState.max_threshold}</li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
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

      {/*SEARCH AND ADD*/}
      <div className='w-full space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between flex-shrink-0'>
        <div className='flex flex-col lg:flex-row gap-2 lg:gap-7 w-full lg:w-auto items-center lg:items-start'>
          {/*SEARCH */}
          <div className='w-full lg:w-[400px] text-sm lg:text-base '>

            <input
              type="text"
              placeholder="Search Item Name..."
              className="border outline outline-1 outline-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all px-3 py-0 rounded-lg w-full h-9 leading-none align-middle"
              onChange={handleSearch}
            />

          </div>

          <DropdownCustom
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            label="Filter by Category:"
            variant="floating"
            options={[
              { value: '', label: 'All Categories' },
              ...listCategories.map(cat => ({
                value: cat.category_id,
                label: cat.category_name
              }))
            ]}
          />

          {(user && user.role && user.role.some(role => ['Branch Manager', 'Owner'].includes(role))) &&

            // Branch dropdown
            <DropdownCustom
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              label="Filter by Branch:"
              variant="floating"
              options={[
                ...(user && user.role && user.role.some(role => ['Owner'].includes(role))
                  ? [{ value: '', label: 'All Branch' }]
                  : branches.length !== 0 ? [] : [{ value: '', label: `${user.branch_name} (Your Branch)`}]),
                ...branches.map(branch => ({
                  value: branch.branch_id,
                  label: `${branch.branch_name}${branch.branch_id === user.branch_id ? ' (Your Branch)' : ''}`
                }))
              ]}
            />

          }

        </div>

        


        {/*EXPORT AND CATEGORIES AND ADD ITEM */}
        <div className="ml-auto flex items-center gap-4">

          {/* Pending approvals button (keeps same height as other controls) */}
          {displayPendingApprovals && (
            <button
              className="relative flex items-center gap-2 px-4 h-10 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => setIsPendingDialogOpen(true)}
              aria-label="Open pending inventory requests"
            >
              <span className="whitespace-nowrap">Pendings</span>
              <span className="inline-flex items-center justify-center w-7 h-7 text-xs font-semibold bg-white text-amber-700 rounded-full">
                {pendingRequests?.length ?? 0}
              </span>
            </button>
          )}

          {/*EXPORT DROPDOWN*/}
          <div className="relative group">
            <button className='bg-blue-800 hover:bg-blue-600 text-white font-medium px-5 h-10 rounded-lg transition-all flex items-center gap-2'>
              <TbFileExport />
              <span className="leading-none">EXPORT</span>
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
              <button
                onClick={() => handleExportInventory('csv')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExportInventory('pdf')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
              >
                Export as PDF
              </button>
            </div>
          </div>

          {/*CATEGORIES AND ADD ITEM - APPEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
          {user && user.role && user.role.some(role => ['Inventory Staff'].includes(role)) && (
            <>
              {/*CATEGORIES BTN*/}
              <button className='bg-[#007278] text-white font-medium hover:bg-[#009097] px-5 h-10 rounded-lg transition-all flex items-center justify-center' onClick={() => setIsCategory(true)}>CATEGORIES</button>

              {/*ADD ITEM BTN*/}
              <button className='bg-[#119200] text-white font-medium hover:bg-[#56be48] text-sm lg:text-base px-5 h-10 rounded-lg transition-all flex items-center justify-center' onClick={() => handleOpen('add')}>ADD ITEMS</button>
            </>
          )}

        </div>


      </div>

      <hr className="border-t-2 my-4 w-full border-gray-500 rounded-lg" />


      {/*TABLE */}
      <div className="overflow-x-auto overflow-y-auto h-[55vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6">
        <table className={`w-full ${filteredData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200 text-sm`}>
          <thead className="sticky top-0 z-10">
            <tr>

              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-40">
                INVENTORY ID
              </th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white">
                ITEM NAME
              </th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-48">
                CATEGORY
              </th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-3">
                UNIT
              </th>
              <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                UNIT PRICE
              </th>

              {user && user.role && user.role.some(role => ['Branch Manager'].includes(role)) &&

                <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                  UNIT COST
                </th>

              }

              <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-4">
                QUANTITY
              </th>

              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-38">
                STATUS
              </th>

              {/*APEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
              {user && user.role && user.role.some(role => ['Inventory Staff'].includes(role)) &&

                <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-20">
                  ACTION
                </th>

              }

            </tr>
          </thead>

          <tbody className="bg-white relative">
            {invetoryLoading ?
              <tr>
                <td colSpan="13" className="h-96 text-center">
                  <ChartLoading message='Loading inventory products...' />
                </td>
              </tr>

              :

              currentPageData.length === 0 ?
                (
                  <NoInfoFound col={11} />
                ) :

                (
                  currentPageData.map((row, rowIndex) => (

                    <tr key={rowIndex} className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1) % 2 === 0 ? "bg-[#F6F6F6]" : ""}`} onClick={() => openDetails(row)} style={{ cursor: 'pointer' }}>
                      <td className="px-4 py-2 text-center"  >{`${String(row.branch_id).padStart(2, '0')}${String(row.category_id).padStart(2, '0')}-${row.product_id}`}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.product_name}</td>
                      <td className="px-4 py-2 whitespace-nowrap"  >{row.category_name}</td>
                      <td className="px-4 py-2"  >{row.unit}</td>
                      <td className="px-4 py-2 text-right"  >{currencyFormat(row.unit_price)}</td>

                      {user && user.role && user.role.some(role => ['Branch Manager'].includes(role)) &&
                        <td className="px-4 py-2 text-right"  >{currencyFormat(row.unit_cost)}</td>
                      }

                      <td className="px-4 py-2 text-right"  >{Number(row.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center w-36"  >
                        <div className={`border rounded-full px-5 py-1 font- ${row.quantity <= row.min_threshold ? 'bg-[#f05959] text-red-900' : row.quantity >= row.max_threshold ? 'bg-[#1e5e1b] text-white' : 'bg-[#61E85C] text-green-700'} font-medium`}>
                          {row.quantity <= row.min_threshold ? 'Low Stock' : row.quantity >= row.max_threshold ? 'Max Stock' : 'In Stock'}
                        </div>
                      </td>

                      {/*APEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
                      {user && user.role && user.role.some(role => ['Inventory Staff'].includes(role)) &&

                        <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            disabled={user.branch_id !== row.branch_id}
                            className="bg-[#007278] hover:bg-[#009097] px-5 py-1 rounded-lg text-white
                                         disabled:bg-gray-400 disabled:cursor-not-allowed"
                            onClick={() => handleOpen('edit', row)}
                          >
                            Update
                          </button>
                        </td>

                      }

                    </tr>
                  ))
                )
            }

          </tbody>
        </table>
        {error && <div className="flex font-bold justify-center px-4 py-4">{error}</div>}
      </div>


      {/*PAGINATION AND CONTROLS */}
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-3 pb-6 px-3'>
        {/* TOP ROW ON MOBILE: ITEM COUNT + PAGINATION */}
        <div className='flex justify-between items-center gap-2 sm:hidden'>
          {/* LEFT: ITEM COUNT (MOBILE) */}
          <div className='text-xs text-gray-600 flex-shrink-0'>
            {filteredData.length > 0 ? (
              <>Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length}</>
            ) : (
              <span></span>
            )}
          </div>

          {/* RIGHT: PAGINATION CONTROLS (MOBILE) */}
          {filteredData.length > 0 && (
            <div className='flex items-center gap-1'>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className='px-2 py-1.5 text-xs border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
              >
                Previous
              </button>
              <span className='text-xs text-gray-600 whitespace-nowrap'>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className='px-2 py-1.5 text-xs border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
              >
                Next
              </button>
            </div>
          )}
        </div>{/* END OF MOBILE VIEW*/}

        {/* DESKTOP LAYOUT: THREE COLUMNS */}
        {/* LEFT: ITEM COUNT (DESKTOP) */}
        <div className='hidden sm:block text-sm lg:text-sm text-gray-600 sm:flex-1'>
          {filteredData.length > 0 ? (
            <>Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} items</>
          ) : (
            <span></span>
          )}
        </div>

        {/* CENTER: PAGINATION CONTROLS (DESKTOP) */}
        <div className='hidden sm:flex sm:justify-center sm:flex-1'>
          {filteredData.length > 0 && (
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className='px-3 py-1.5 text-sm border rounded-lg bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
              >
                Previous
              </button>
              <span className='text-sm text-gray-600 whitespace-nowrap'>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className='px-3 py-1.5 text-sm border rounded-lg bg-white hover:bg-gray-200  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: INVENTORY HISTORY BUTTON (BOTH MOBILE & DESKTOP) */}
        <div className='flex justify-end sm:flex-1'>
          <button
            className='bg-white hover:bg-gray-200 rounded-lg border  transition-all py-2 px-3 lg:px-5 text-sm whitespace-nowrap w-full sm:w-auto'
            onClick={() => setIsProductTransactOpen(true)}
          >
            Show Inventory History
          </button>
        </div>
      </div>

    </div>




  )

}

export default ProductInventory;
