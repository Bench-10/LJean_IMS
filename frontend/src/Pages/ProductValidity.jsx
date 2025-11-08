import { React, useState, useEffect } from 'react';
import { RiErrorWarningLine } from "react-icons/ri";
import { TbFileExport } from "react-icons/tb";
import api from '../utils/api';
import NoInfoFound from '../components/common/NoInfoFound';
import { useAuth } from '../authentication/Authentication';
import ChartLoading from '../components/common/ChartLoading';
import { exportToCSV, exportToPDF, formatForExport } from "../utils/exportUtils";
import DropdownCustom from '../components/DropdownCustom';

function ProductValidity({ sanitizeInput, productValidityList: propValidityList, setProductValidityList: setPropValidityList }) {
  const [productValidityList, setValidity] = useState(propValidityList || []);
  const [searchValidity, setSearchValidity] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNearExpiry, setShowNearExpiry] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // SHOW 50 ITEMS PER PAGE

  const { user } = useAuth();
  const cacheKey = `product_validity_branch_${user?.branch_id || 'unknown'}`;


  const getProductInfo = async ({ force = false } = {}) => {
    // If we already have cached data and not forcing, show it immediately without spinner
    try {
      if (!force) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setValidity(parsed);
              if (setPropValidityList) setPropValidityList(parsed);
            }
          } catch (e) {
            // ignore parse errors and continue to fetch
            console.warn('Failed to parse product validity cache', e);
          }
        }
      }

      // show spinner only when there's no cached data or when force is true
      const hasCache = Boolean(sessionStorage.getItem(cacheKey));
      if (!hasCache || force) setLoading(true);

      const data = await api.get(`/api/product_validity?branch_id=${user.branch_id}`);
      setValidity(data.data);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data.data));
      } catch (e) {
        console.warn('Failed to write product validity cache', e);
      }

      if (setPropValidityList) {
        setPropValidityList(data.data);
      }
    } catch (error) {
      console.log(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // On mount: show cache if available, then refresh in background
    getProductInfo({ force: false });
  }, [user.branch_id]);

  // LISTEN FOR REAL-TIME VALIDITY UPDATES
  useEffect(() => {
    const handleValidityUpdate = (event) => {
      const validityData = event.detail;
      console.log('Validity update received in component:', validityData);

      if (validityData.action === 'add') {
        // ADD NEW VALIDITY ENTRY
        const updateFunction = (prevValidity) => [validityData.product, ...prevValidity];
        setValidity(updateFunction);
        if (setPropValidityList) setPropValidityList(updateFunction);
        // persist cache
        try {
          const cur = JSON.parse(sessionStorage.getItem(cacheKey) || '[]');
          sessionStorage.setItem(cacheKey, JSON.stringify([validityData.product, ...cur]));
        } catch (e) {
          // ignore cache write errors
        }
      } else if (validityData.action === 'update') {
        // UPDATE EXISTING VALIDITY ENTRY OR ADD NEW ONE
        const updateFunction = (prevValidity) => {
          const existingIndex = prevValidity.findIndex(
            item => item.product_id === validityData.product.product_id &&
              item.date_added === validityData.product.date_added
          );

          if (existingIndex >= 0) {
            // UPDATE EXISTING
            const updated = [...prevValidity];
            updated[existingIndex] = { ...updated[existingIndex], ...validityData.product };
            return updated;
          } else {
            // ADD NEW
            return [validityData.product, ...prevValidity];
          }
        };
        setValidity(updateFunction);
        if (setPropValidityList) setPropValidityList(updateFunction);
        // update cache
        try {
          const cur = JSON.parse(sessionStorage.getItem(cacheKey) || '[]');
          const existingIndex = cur.findIndex(
            item => item.product_id === validityData.product.product_id && item.date_added === validityData.product.date_added
          );
          let updated;
          if (existingIndex >= 0) {
            updated = [...cur];
            updated[existingIndex] = { ...updated[existingIndex], ...validityData.product };
          } else {
            updated = [validityData.product, ...cur];
          }
          sessionStorage.setItem(cacheKey, JSON.stringify(updated));
        } catch (e) {
          // ignore cache write errors
        }
      } else if (validityData.action === 'inventory_changed_by_sale' ||
        validityData.action === 'inventory_changed_by_delivery' ||
        validityData.action === 'stock_deducted' ||
        validityData.action === 'stock_restored') {
        // REFRESH DATA WHEN INVENTORY CHANGES AFFECT VALIDITY DISPLAY
        console.log('Refreshing validity data due to inventory changes:', validityData.action);
        // force refresh to get authoritative view
        getProductInfo({ force: true });
      }
    };

    window.addEventListener('validity-update', handleValidityUpdate);

    return () => {
      window.removeEventListener('validity-update', handleValidityUpdate);
    };
  }, []);




  const handleSearch = (event) => {
    setSearchValidity(sanitizeInput(event.target.value));
    setCurrentPage(1); // RESET TO FIRST PAGE WHEN SEARCHING
  }


  const filteredValidityData = productValidityList.filter(validity =>
  // Basic search match
  (validity.product_name.toLowerCase().includes(searchValidity.toLowerCase()) ||
    validity.category_name.toLowerCase().includes(searchValidity.toLowerCase()) ||
    validity.formated_date_added.toLowerCase().includes(searchValidity.toLowerCase()) ||
    validity.formated_product_validity.toLowerCase().includes(searchValidity.toLowerCase()))
  )
    // Then apply expiry toggles and date filters
    .filter(validity => {
      // Expiry toggles: if either toggle is active, only include matching types
      if (showNearExpiry || showExpired) {
        const isNear = Boolean(validity.near_expy);
        const isExp = Boolean(validity.expy);
        if (!((isNear && showNearExpiry) || (isExp && showExpired))) {
          return false;
        }
      }

      // Year filter (use DB `year` column)
      if (selectedYear) {
        if (validity.year == null || String(validity.year) !== String(selectedYear)) return false;
      }

      // Month filter (use DB `month` column)
      if (selectedMonth) {
        if (validity.month == null || String(Number(validity.month)) !== String(Number(selectedMonth))) return false;
      }

      return true;
    });

  // PAGINATION LOGIC
  const totalItems = filteredValidityData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredValidityData.slice(startIndex, endIndex);

  // Export functionality
  const handleExportValidity = (format) => {
    const exportData = formatForExport(filteredValidityData, []);
    const filename = `product_validity_export_${new Date().toISOString().split('T')[0]}`;

    const customHeaders = ['Product Name', 'Category', 'Date Added', 'Product Validity Date', 'Quantity Left'];
    const dataKeys = ['product_name', 'category_name', 'formated_date_added', 'formated_product_validity', 'quantity_left'];

    if (format === 'csv') {
      exportToCSV(exportData, filename, customHeaders, dataKeys);
    } else if (format === 'pdf') {
      exportToPDF(exportData, filename, {
        title: 'Product Validity Report',
        customHeaders: customHeaders,
        dataKeys: dataKeys
      });
    }
  };



  return (
    <div className="pt-20 lg:pt-8 px-4 lg:px-8" >
      {/*TITLE*/}
      <h1 className='text-[33px] leading-[36px] font-bold text-green-900'>
        PRODUCT VALIDITY
      </h1>

      <hr className="mt-3 mb-6 border-t-4 border-green-800 rounded-lg" />

      {/*SEARCH AND ADD*/}
      {/* SEARCH + FILTERS (1 line on desktop; controls at right) */}
<div className="w-full lg:flex lg:items-center lg:flex-nowrap lg:gap-4">
  {/* SEARCH (left) */}
  <div className="w-full lg:basis-[360px] lg:flex-none text-sm lg:text-sm pb-3 lg:pb-0">
    <input
      type="text"
      placeholder="Search Item Name or Category"
      className="border outline outline-1 outline-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:py-2 transition-all px-3 py-2 rounded-lg w-full h-9"
      onChange={handleSearch}
    />
  </div>

  {/* RIGHT: chips + dropdowns (flush right on desktop) */}
  <div className="w-full lg:w-auto lg:ml-auto lg:flex lg:items-center lg:justify-end lg:gap-3">
    {/* Chips: grid on mobile, inline on desktop */}
    <div className="grid grid-cols-2 gap-2 w-full lg:w-auto lg:flex lg:flex-nowrap lg:gap-3 lg:shrink-0">
      <button
        type="button"
        onClick={() => { setShowNearExpiry(p => !p); setCurrentPage(1); }}
        className={`w-full lg:w-auto flex h-[36px] items-center justify-center gap-2 px-3 lg:px-4 text-sm rounded-lg border transition-all
          ${showNearExpiry
            ? 'bg-[#FFF3C1] text-gray-900 border-yellow-400 ring-2 ring-yellow-400 ring-offset-2'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-yellow-50'}`}
      >
        <span className="w-3 h-3 lg:w-4 lg:h-4 rounded-full bg-[#f8e189]" />
        <span className="whitespace-nowrap">Near Expiry</span>
      </button>

      <button
        type="button"
        onClick={() => { setShowExpired(p => !p); setCurrentPage(1); }}
        className={`w-full lg:w-auto flex h-[36px] lg:h-[38px] items-center justify-center gap-2 px-3 lg:px-4 text-sm rounded-lg border transition-all
          ${showExpired
            ? 'bg-[#FF3131] text-white border-red-500 ring-2 ring-red-400 ring-offset-2'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-red-50'}`}
      >
        <span className="w-3 h-3 lg:w-4 lg:h-4 rounded-full bg-[#c32525]" />
        <span className="whitespace-nowrap">Expired</span>
      </button>
    </div>

    {/* Year/Month: grid on mobile, inline on desktop */}
    <div className="grid grid-cols-2 gap-2 w-full lg:w-auto lg:flex lg:flex-nowrap lg:gap-2 lg:ml-3 lg:shrink-0 mt-2 lg:mt-0">
      <div className="col-span-1 lg:w-40">
        <DropdownCustom
          value={selectedYear}
          onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
          variant="simple"
          options={[
            { value: '', label: 'All Years' },
            ...Array.from(new Set(productValidityList.map(v => v.year).filter(Boolean)))
              .sort((a, b) => b - a)
              .map(y => ({ value: y, label: y }))
          ]}
        />
      </div>
      <div className="col-span-1 lg:w-40">
        <DropdownCustom
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }}
          variant="simple"
          options={[
            { value: '', label: 'All Months' },
            ...(() => {
              const names = [null,'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const months = Array.from(new Set(productValidityList.map(v => v.month).filter(m => m != null).map(Number))).sort((a,b)=>a-b);
              return months.map(m => ({ value: m, label: names[m] || m }));
            })()
          ]}
        />
      </div>
    </div>
  </div>
</div>


      <hr className="border-t-2 my-4 w-full border-gray-500 rounded-lg" />

      {/* MOBILE CARD VIEW */}
      <div className="block lg:hidden space-y-3 overflow-y-auto h-[55vh] pb-6 hide-scrollbar">
        {loading ? (
          <div className='h-96 flex items-center justify-center'>
            <ChartLoading message='Loading products...' />
          </div>
        ) : currentPageData.length === 0 ? (
          <div className='h-96 flex items-center justify-center'>
            <NoInfoFound isTable={false} />
          </div>
        ) : (
          currentPageData.map((validity, index) => (
            <div
              key={index}
              className={`rounded-lg p-4 border-l-4 shadow-sm ${
                validity.expy
                  ? 'bg-[#bc2424] text-white border-red-700'
                  : validity.near_expy
                  ? 'bg-[#FFF3C1] border-yellow-500'
                  : 'bg-white border-gray-300'
              }`}
            >
              {(validity.expy || validity.near_expy) && (
                <div className="flex items-center gap-2 mb-2">
                  <RiErrorWarningLine className="text-xl" />
                  <span className="font-semibold text-sm">
                    {validity.expy ? 'EXPIRED' : 'NEAR EXPIRY'}
                  </span>
                </div>
              )}
             
              <div className="space-y-2 text-sm">
                <div className="font-bold text-base">{validity.product_name}</div>
               
                <div className="flex justify-between">
                  <span className="text-white-600">Category:</span>
                  <span className="font-medium">{validity.category_name}</span>
                </div>
               
                <div className="flex justify-between">
                  <span className="text-white-600">Date Purchased:</span>
                  <span className="font-medium">{validity.formated_date_added}</span>
                </div>
               
                <div className="flex justify-between">
                  <span className="text-white-600">Expiry Date:</span>
                  <span className="font-medium">{validity.formated_product_validity}</span>
                </div>
               
                <div className="flex justify-between">
                  <span className="text-white-600">Quantity:</span>
                  <span className="font-bold text-base">{validity.quantity_left}</span>
                </div>
              </div>
            </div>
          ))
        )}
        
      </div>

      <hr className="border-t-2 my-4 w-full border-gray-500 rounded-lg lg:hidden" />


      {/*DESKTOP VIEW*/}
      <div className="hidden lg:block overflow-x-auto overflow-y-auto h-[55vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6">
        <table className={`w-full ${currentPageData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200 text-sm`}>
          <thead className="sticky top-0 z-20">

            <tr>

              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-56">
                DATE PURCHASED
              </th>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-72">
                EXPIRY DATE
              </th>
              <th className="bg-green-500 pl-7 pr-4 py-2 text-left text-sm font-medium text-white">
                ITEM NAME
              </th>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-72">
                CATEGORY
              </th>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-72">
                QUANTITY
              </th>


            </tr>
          </thead>


          <tbody className="bg-white relative">
            {loading ?
              (
                <tr>
                  <td colSpan={5} className='h-96 text-center'>
                    <ChartLoading message='Loading products...' />
                  </td>
                </tr>

              )
              :

              currentPageData.length === 0 ?

                (
                  <NoInfoFound col={5} />
                ) :

                (
                  currentPageData.map((validity, index) => (
                    <tr
                      key={index}
                      className={
                        validity.expy
                          ? 'bg-[#bc2424] text-white hover:bg-[#bc2424]/90 h-14'
                          : validity.near_expy
                            ? 'bg-[#FFF3C1] hover:bg-yellow-100 h-14'
                            : 'hover:bg-gray-200/70 h-14'
                      }
                    >
                      {(validity.expy || validity.near_expy) ?

                        (<td className="flex px-4 py-2 text-center gap-x-10 items-center mt-[5%]"  >

                          <div className='flex items-center'>
                            <RiErrorWarningLine className='h-[100%]' />
                          </div>

                          <div>
                            {validity.formated_date_added}
                          </div>

                        </td>
                        ) :

                        (
                          <td className="px-4 py-2 text-center items-center "  >
                            {validity.formated_date_added}
                          </td>
                        )

                      }


                      <td className="px-4 py-2 text-center font-medium whitespace-nowrap" >{validity.formated_product_validity}</td>
                      <td className="pl-7 pr-4 py-2 text-left whitespace-nowrap" >{validity.product_name}</td>
                      <td className="px-4 py-2 text-center "  >{validity.category_name}</td>
                      <td className="px-4 py-2 text-center "  >{validity.quantity_left}</td>

                    </tr>

                  ))

                )
            }

          </tbody>
        </table>
      </div>

      {/*PAGINATION AND CONTROLS */}
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-3 pb-4 lg:pb-6 px-3'>
        {/* TOP ROW ON MOBILE: ITEM COUNT + PAGINATION */}
        <div className='flex justify-between items-center gap-2 sm:hidden'>
          {/* LEFT: ITEM COUNT (MOBILE) */}
          <div className='text-xs text-gray-600 flex-shrink-0'>
            {filteredValidityData.length > 0 ? (
              <>Showing {startIndex + 1} to {Math.min(endIndex, filteredValidityData.length)} of {filteredValidityData.length}</>
            ) : (
              <span></span>
            )}
          </div>

          {/* RIGHT: PAGINATION CONTROLS (MOBILE) */}
          {filteredValidityData.length > 0 && (
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
        </div>

        {/* DESKTOP LAYOUT: THREE COLUMNS */}
        {/* LEFT: ITEM COUNT (DESKTOP) */}
        <div className='hidden sm:block text-[13px] text-gray-600 sm:flex-1'>
          {filteredValidityData.length > 0 ? (
            <>Showing {startIndex + 1} to {Math.min(endIndex, filteredValidityData.length)} of {filteredValidityData.length} items</>
          ) : (
            <span></span>
          )}
        </div>

        {/* CENTER: PAGINATION CONTROLS (DESKTOP) */}
        <div className='hidden sm:flex sm:justify-center sm:flex-1'>
          {filteredValidityData.length > 0 && (
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className='px-3 py-1.5 text-[13px] border rounded-lg bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
              >
                Previous
              </button>
              <span className='text-[13px] text-gray-600 whitespace-nowrap'>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className='px-3 py-1.5 text-[13px] border rounded-lg bg-white hover:bg-gray-200  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: EXPORT DROPDOWN */}
        <div className='flex justify-center sm:justify-end w-full sm:flex-1'>
          <div className="relative group w-full sm:w-auto">
            <button className='bg-blue-800 hover:bg-blue-600 text-white font-medium px-4 lg:px-5 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-[13px] w-full sm:w-auto'>
              <TbFileExport />EXPORT
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 bottom-full mb-2 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
              <button
                onClick={() => handleExportValidity('csv')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-[13px] whitespace-nowrap"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExportValidity('pdf')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-[13px] whitespace-nowrap"
              >
                Export as PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductValidity
