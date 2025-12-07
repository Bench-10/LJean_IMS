import React, { useState, useEffect } from 'react';
import NoInfoFound from '../components/common/NoInfoFound.jsx';
import { TbFileExport } from "react-icons/tb";
import { exportToCSV, exportToPDF, formatForExport } from "../utils/exportUtils";
import { useAuth } from '../authentication/Authentication';
import { currencyFormat } from '../utils/formatCurrency.js';
import InventoryItemDetailsDialog from '../components/InventoryItemDetailsDialog.jsx';
import ChartLoading from '../components/common/ChartLoading.jsx';
import DropdownCustom from '../components/DropdownCustom';

function ProductInventory({
  branches,
  handleOpen,
  productsData,
  setIsCategory,
  setIsProductTransactOpen,
  sanitizeInput,
  listCategories,
  invetoryLoading
}) {
  const { user } = useAuth();
  const [searchItem, setSearchItem] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'low', 'max', 'none'

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

      {/* Pending inventory actions moved to dedicated page */}

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
                  } cursor-pointer`}
                  onClick={() => openDetails(row)}
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





