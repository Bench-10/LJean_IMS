import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api.js';
import DropdownCustom from '../components/DropdownCustom';
import DatePickerCustom from '../components/DatePickerCustom.jsx';
import { BsFunnelFill } from "react-icons/bs";
import { TbFileExport } from "react-icons/tb";
import { IoMdClose } from "react-icons/io";
import NoInfoFound from './common/NoInfoFound.jsx';
import { useAuth } from '../authentication/Authentication';
import { currencyFormat } from '../utils/formatCurrency.js';
import ChartLoading from './common/ChartLoading.jsx';
import { exportToCSV, exportToPDF, formatForExport } from "../utils/exportUtils";

function ProductTransactionHistory({ isProductTransactOpen, onClose, sanitizeInput, listCategories, focusEntry, onClearFocus }) {

  const [openFilter, setOpenFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productHistory, setProductHistory] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);

  const rowRefs = useRef({});
  const pendingFocusRef = useRef(null);
  const [pendingRowKey, setPendingRowKey] = useState(null);
  const [highlightedRowKey, setHighlightedRowKey] = useState(null);

  const { user } = useAuth();

  const matchesFocus = (entry, focus) => {
    if (!entry || !focus) return false;

    const timestampsEqual = (first, second) => {
      if (!first || !second) return false;
      const firstDate = new Date(first);
      const secondDate = new Date(second);
      return !Number.isNaN(firstDate.getTime())
        && !Number.isNaN(secondDate.getTime())
        && firstDate.getTime() === secondDate.getTime();
    };

    const entryAlertValue = entry.alert_timestamp || entry.alertTimestamp;
    if (focus.alertTimestamp && timestampsEqual(entryAlertValue, focus.alertTimestamp)) {
      return true;
    }

    const entryHistoryValue = entry.history_timestamp || entry.date_added;
    if (focus.historyTimestamp && timestampsEqual(entryHistoryValue, focus.historyTimestamp)) {
      return true;
    }

    if (focus.dateAdded && timestampsEqual(entry.date_added, focus.dateAdded)) {
      return true;
    }

    const entryAddId = entry.add_id ?? entry.add_stock_id ?? entry.addStockId;
    if (focus.addStockId && entryAddId !== undefined && entryAddId !== null) {
      if (Number(entryAddId) === Number(focus.addStockId)) {
        return true;
      }
    }

    if (focus.productId && entry.product_id !== undefined && entry.product_id !== null) {
      if (Number(entry.product_id) === Number(focus.productId)) {
        return true;
      }
    }

    if (focus.productName && entry.product_name) {
      if (entry.product_name.toLowerCase() === focus.productName.toLowerCase()) {
        return true;
      }
    }

    return false;
  };

  const getEntryKey = (entry, fallbackIndex = 0) => {
    if (!entry) return `history-row-${fallbackIndex}`;

    if (entry.alert_timestamp) {
      const timestampKey = new Date(entry.alert_timestamp).getTime();
      if (!Number.isNaN(timestampKey)) {
        return `history-alert-${timestampKey}`;
      }
    }

    if (entry.history_timestamp) {
      const historyKey = new Date(entry.history_timestamp).getTime();
      if (!Number.isNaN(historyKey)) {
        return `history-history-${historyKey}`;
      }
    }

    const entryAddId = entry.add_id ?? entry.add_stock_id ?? entry.addStockId;

    if (entryAddId !== undefined && entryAddId !== null) {
      return `history-add-${entryAddId}`;
    }

    if (entry.product_id !== undefined && entry.product_id !== null && entry.date_added) {
      return `history-${entry.product_id}-${entry.date_added}`;
    }

    return `history-row-${fallbackIndex}`;
  };

  // PAGINATION LOGIC
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate]);

  useEffect(() => {
    if (focusEntry) {
      pendingFocusRef.current = focusEntry;

      if (isProductTransactOpen) {
        setSearch('');
        setSelectedCategory('');
        setStartDate('');
        setEndDate('');
      }
    }
  }, [focusEntry, isProductTransactOpen]);

  useEffect(() => {
    if (!isProductTransactOpen) {
      setHighlightedRowKey(null);
      setPendingRowKey(null);
      pendingFocusRef.current = null;
    }
  }, [isProductTransactOpen]);

  const closeFilterValue = () => {
    setOpenFilter(false);
    setEndDate('');
    setStartDate('');
  };

  const handleClose = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
    setHighlightedRowKey(null);
    setPendingRowKey(null);
    pendingFocusRef.current = null;
    onClose();
    setOpenFilter(false);
  };

  const applyFilter = () => {
    if (!startDate && !endDate) {
      fetchProductHistory();
      setOpenFilter(false);
      return;
    }

    if ((startDate > endDate) && endDate) {
      alert('End date must not be before the Start date!');
      return;
    }

    if (startDate && !endDate) {
      fetchProductHistory();
    }

    fetchProductHistory();
    setOpenFilter(false);
  };

  const fetchProductHistory = async () => {
    const dates = { startDate, endDate };

    try {
      setLoading(true);
      let response;
      if (!user || !user.role || !user.role.some(role => ['Owner'].includes(role))) {
        response = await api.post(`/api/product_history?branch_id=${user.branch_id}`, dates);
      } else {
        response = await api.post(`/api/product_history/`, dates);
      }
      setProductHistory(response.data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isProductTransactOpen)
      fetchProductHistory();
  }, [isProductTransactOpen]);

  // LISTEN FOR REAL-TIME HISTORY UPDATES
  useEffect(() => {
    const handleHistoryUpdate = (event) => {
      const historyData = event.detail;
      console.log('History update received in component:', historyData);

      if (historyData.action === 'add' || historyData.action === 'update') {
        // ADD NEW HISTORY ENTRY AT THE TOP
        setProductHistory(prevHistory => [historyData.historyEntry, ...prevHistory]);

        // SHOW A BRIEF VISUAL INDICATOR (if modal is open)
        if (isProductTransactOpen) {
          console.log(`📋 New history entry: ${historyData.historyEntry.product_name} (${historyData.historyEntry.quantity_added} units)`);
        }
      }
    };

    window.addEventListener('history-update', handleHistoryUpdate);

    return () => {
      window.removeEventListener('history-update', handleHistoryUpdate);
    };
  }, [isProductTransactOpen]);

  useEffect(() => {
    if (!isProductTransactOpen || !pendingFocusRef.current || loading) return;
    if (!Array.isArray(productHistory) || productHistory.length === 0) return;

    const activeFocus = pendingFocusRef.current;
    const matchIndex = productHistory.findIndex(entry => matchesFocus(entry, activeFocus));

    if (matchIndex === -1) {
      return;
    }

    const targetEntry = productHistory[matchIndex];
    const targetKey = getEntryKey(targetEntry, matchIndex);

    pendingFocusRef.current = null;

    const targetPage = Math.floor(matchIndex / itemsPerPage) + 1;
    setCurrentPage(targetPage);
    setPendingRowKey(targetKey);

    setSearch('');
    setSelectedCategory('');
    setStartDate('');
    setEndDate('');

    if (typeof onClearFocus === 'function') {
      onClearFocus();
    }
  }, [productHistory, isProductTransactOpen, itemsPerPage, loading, onClearFocus]);

  const handleSearch = (event) => {
    setSearch(sanitizeInput(event.target.value));
  };

  let filteredHistory = productHistory;

  // FILTER BY CATEGORY
  filteredHistory = selectedCategory
    ? productHistory.filter((items) => items.category_id === Number(selectedCategory))
    : filteredHistory;

  // PAGINATION: filter first, then paginate
  let filteredHistoryData = filteredHistory.filter(product =>
    product.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = filteredHistoryData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredHistoryData.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (!pendingRowKey) return;

    const targetRow = rowRefs.current[pendingRowKey];

    if (!targetRow) {
      return;
    }

    setHighlightedRowKey(pendingRowKey);
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const timer = setTimeout(() => {
      setHighlightedRowKey(null);
      setPendingRowKey(null);
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [currentData, pendingRowKey]);

  // Friendly display bounds
  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = endIndex;

  // Export functionality
  const handleExportHistory = (format) => {
    const exportData = formatForExport(filteredHistoryData, []);
    const filename = `product_history_export_${new Date().toISOString().split('T')[0]}`;

    const customHeaders = ['Date Added', 'Product Name', 'Category', 'Cost', 'Quantity'];
    const dataKeys = ['formated_date_added', 'product_name', 'category_name', 'h_unit_cost', 'quantity_added'];

    if (format === 'csv') {
      exportToCSV(exportData, filename, customHeaders, dataKeys);
    } else if (format === 'pdf') {
      exportToPDF(exportData, filename, {
        title: 'Product Transaction History Report',
        customHeaders: customHeaders,
        dataKeys: dataKeys
      });
    }
  };

  rowRefs.current = {};

  return (
    <div>
      {isProductTransactOpen && (
        <div
          className='fixed inset-0 bg-black/35 bg-opacity-50 z-[9998] backdrop-blur-sm'
          onClick={() => { onClose(); closeFilterValue(); setProductHistory([]); }}
        />
      )}

      <dialog className='bg-transparent fixed top-0 bottom-0 z-[9999]' open={isProductTransactOpen}>
        <div className="relative flex flex-col border border-gray-600/40 bg-white h-[80vh] sm:h-[85vh] lg:h-[90vh] w-[96vw] sm:w-[95vw] max-h-none sm:max-h-[600px] max-w-none sm:max-w-[1000px] rounded-xl p-3 sm:p-4 lg:p-7 pb-4 sm:pb-8 border-gray-300 animate-popup mx-auto my-auto">
          <button
            type="button"
            className="absolute top-4 right-3 sm:top-4 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors z-10"
            onClick={() => { onClose(); setOpenFilter(false); closeFilterValue(); handleClose(); setProductHistory([]); }}
            aria-label="Close"
          >
            <IoMdClose className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* TITLE AND FILTER SECTION */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-2  gap-4 sm:gap-0">
            {/* LEFT SIDE */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full pt-2">
              {/* TITLE */}
              <h1 className="font-bold text-3xl sm:text-4xl text-gray-800 tracking-tight">
                Product History
              </h1>

              {/* SEARCH + CATEGORY */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center w-full sm:w-auto gap-2 sm:gap-3">
                <input
                  type="text"
                  className="h-9 w-full sm:w-64 border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:border-green-500 focus:ring-green-500 outline-none"
                  placeholder="Search Item Name..."
                  onChange={handleSearch}
                  value={search}
                />

                <div className='relative w-full'>
                  <DropdownCustom
                    size="sm"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setCurrentPage(1);
                    }}
                    options={[
                      { value: '', label: 'All Categories' },
                      ...(listCategories ? listCategories.map(cat => ({
                        value: cat.category_id,
                        label: cat.category_name
                      })) : [])
                    ]}
                  />
                </div>

                {/* RIGHT SIDE - FILTER BUTTON & POPUP */}
                <div className="relative mt-2 sm:mt-0 w-full lg:w-auto overflow-visible">
                  {/* POPUP (no nested <dialog>) */}
                  {openFilter && (
                    <div
                      className="absolute z-[10000]
                        top-[110%] left-1/2 -translate-x-1/2
                        sm:top-[100%] sm:left-auto sm:right-0 sm:translate-x-0"
                    >
                      <div className="w-[92vw] sm:w-[360px] max-w-[420px]
                        border rounded-md px-3 py-4 shadow-lg text-xs bg-white">
                        <h1 className="font-bold text-md">Filter</h1>

                        <div className="w-full mt-3">
                          <DatePickerCustom
                            label="Start date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            placeholder="Select start date"
                            id="start-date"
                          />
                        </div>

                        <div className="w-full mt-3">
                          <DatePickerCustom
                            label="End date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            placeholder="Select end date"
                            id="end-date"
                          />
                        </div>

                        <div className="w-full mt-4 flex gap-2">
                          <button
                            className="flex-1 bg-white py-1.5 px-4 text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md transition-colors font-medium"
                            onClick={async () => {
                              setEndDate(''); setStartDate('');
                              try {
                                setLoading(true);
                                const dates = { startDate: '', endDate: '' };
                                let response;
                                if (!user || !user.role || !user.role.some(role => ['Owner'].includes(role))) {
                                  response = await api.post(`/api/product_history?branch_id=${user.branch_id}`, dates);
                                } else {
                                  response = await api.post(`/api/product_history/`, dates);
                                }
                                setProductHistory(response.data);
                              } catch (error) {
                                setError(error.message);
                              } finally {
                                setLoading(false);
                              }
                              setOpenFilter(false);
                            }}
                          >
                            Clear
                          </button>
                          <button
                            className="flex-1 bg-gray-800 py-1.5 px-4 text-white hover:bg-gray-700 border border-gray-800 rounded-md transition-colors font-medium"
                            onClick={applyFilter}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    className={`h-9 w-full sm:w-9 flex items-center justify-center border border-gray-300 rounded-md 
                      hover:bg-gray-100 transition-colors flex-shrink-0 outline-none
                      ${openFilter ? 'ring-2 ring-blue-500 border-blue-500 bg-gray-50' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                    onClick={() => { openFilter ? closeFilterValue() : setOpenFilter(true); }}
                  >
                    <BsFunnelFill className='w-4 h-4 text-gray-700' />
                    <span className='ml-2 sm:hidden text-sm'>Filter</span>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* HISTORY TABLE SECTION */}
          <div className='overflow-x-auto overflow-y-auto w-full flex-1 mt-4 rounded-lg shadow-sm border border-gray-200 hide-scrollbar'>
            <table className='w-full min-w-[640px] table-fixed'>
              <thead className='sticky top-0 h-10 z-40'>
                <tr className='bg-gray-200'>
                  <th className='px-2 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Date</th>
                  <th className='px-2 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-[30%]'>
                    Item Name
                  </th>
                  <th className='px-2 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Category</th>
                  <th className='px-2 sm:px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Unit Cost</th>
                  <th className='px-2 sm:px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Quantity</th>
                  <th className='px-2 sm:px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>Value</th>
                </tr>
              </thead>
              <tbody className='bg-white relative'>
                {loading ? (
                  <tr>
                    <td colSpan={6}>
                      <ChartLoading message="Loading product history..." />
                    </td>
                  </tr>
                ) :
                  (filteredHistoryData.length === 0 ?
                    (
                      <NoInfoFound col={6} />
                    ) :
                    (
                      currentData.map((history, histoindx) => {
                        const rowKey = getEntryKey(history, startIndex + histoindx);
                        const isHighlighted = highlightedRowKey === rowKey;

                        return (
                          <tr
                            key={rowKey}
                            ref={el => {
                              if (el) {
                                rowRefs.current[rowKey] = el;
                              } else {
                                delete rowRefs.current[rowKey];
                              }
                            }}
                            data-alert-timestamp={history.alert_timestamp ?? undefined}
                            className={`transition-colors duration-300 ease-in-out border-b border-gray-100 ${isHighlighted ? 'bg-green-200' : 'hover:bg-gray-100'}`}
                          >
                            <td className='px-2 sm:px-4 lg:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500'>
                              {history.formated_date_added}
                            </td>

                            {/* Item Name – wider and horizontally scrollable */}
                            <td className="px-2 sm:px-4 lg:px-6 py-3 text-xs sm:text-sm font-medium text-gray-900 align-middle w-[30%]">
                              <div className="max-w-[260px] sm:max-w-[320px] overflow-x-auto whitespace-nowrap hide-scrollbar">
                                {history.product_name}
                              </div>
                            </td>

                            <td className='px-2 sm:px-4 lg:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500'>
                              {history.category_name}
                            </td>
                            <td className='px-2 sm:px-4 lg:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 text-right'>
                              {currencyFormat(history.h_unit_cost)}
                            </td>
                            <td className='px-2 sm:px-4 lg:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 text-right'>
                              {history.quantity_added.toLocaleString()}
                            </td>
                            <td className='px-2 sm:px-4 lg:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 text-right'>
                              {currencyFormat(history.value)}
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

          {/* PAGINATION CONTROLS + EXPORT */}
          <div className='mt-3 px-1 sm:px-3'>
            {/* Mobile Layout */}
            <div className='flex flex-col sm:hidden gap-2'>
              {/* Showing Stats + Pagination */}
              <div className='flex items-center justify-between gap-2'>
                {/* Showing Stats - Left */}
                {totalItems > 0 && (
                  <div className='text-xs text-gray-600 flex-shrink-0'>
                    Showing {displayStart}-{displayEnd} of {totalItems}
                  </div>
                )}

                {/* Pagination Controls - Right */}
                <div className='flex items-center gap-1 flex-shrink-0'>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className='px-2 py-1 text-xs border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    Previous
                  </button>
                  <span className='text-xs text-gray-600 whitespace-nowrap px-1'>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className='px-2 py-1 text-xs border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Export Button */}
              <div className='flex justify-center'>
                <div className="relative group w-full max-w-xs">
                  <button className='bg-blue-800 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-md transition-all flex items-center justify-center gap-2 text-sm w-full'>
                    <TbFileExport className='text-base' />
                    <span>Export History</span>
                  </button>
                  {/* Centered Dropdown for Mobile */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 w-full">
                    <button
                      onClick={() => handleExportHistory('csv')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExportHistory('pdf')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
                    >
                      Export as PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className='hidden sm:flex items-center justify-between  gap-4 w-full'>
              {/* Showing + Pagination */}
              <div className='flex items-center gap-4'>
                {totalItems > 0 && (
                  <div className='text-sm text-gray-600 flex-shrink-0'>
                    Showing {displayStart}-{displayEnd} of {totalItems}
                  </div>
                )}
              </div>

              <div className='flex-1 flex justify-center items-center space-x-2'>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className='px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Previous
                </button>
                <span className='text-sm text-gray-600 whitespace-nowrap px-1'>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className='px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Next
                </button>
              </div>

              {/* Export Button */}
              <div className="relative group">
                <button className='bg-blue-800 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-md transition-all flex items-center justify-center gap-2 text-sm'>
                  <TbFileExport className='text-base' />
                  <span>Export History</span>
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-full">
                  <button
                    onClick={() => handleExportHistory('csv')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExportHistory('pdf')}
                    className="block w-full rounded-lg text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
                  >
                    Export as PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </dialog>
    </div>
  );
}

export default ProductTransactionHistory;
