import {React, useState, useEffect } from 'react';
import { RiErrorWarningLine } from "react-icons/ri";
import { TbFileExport } from "react-icons/tb";
import api from '../utils/api';
import NoInfoFound from '../components/common/NoInfoFound';
import { useAuth } from '../authentication/Authentication';
import ChartLoading from '../components/common/ChartLoading';
import { exportToCSV, exportToPDF, formatForExport } from "../utils/exportUtils";

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

  const {user} = useAuth();
  const cacheKey = `product_validity_branch_${user?.branch_id || 'unknown'}`;
  

  const getProductInfo = async ({ force = false } = {}) =>{
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

  useEffect(() =>{
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


  
  
  const handleSearch = (event) =>{
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
      if (!( (isNear && showNearExpiry) || (isExp && showExpired) )) {
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
    <div className="pt-20 lg:pt-8 px-4 lg:px-8 pb-6 h-screen" >
        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          PRODUCT VALIDITY
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>

        {/*SEARCH AND ADD*/}
        <div className='flex w-full'>
          {/*SEARCH */}
          <div className='w-[400px]'>
            
            <input
              type="text"
              placeholder="Search Date Item Name or Category"
              className={`border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9`}
              onChange={handleSearch}
             
            />

          </div>

          <div  className="ml-auto flex gap-4 items-center">
            
    
            {/*EXPIRY FILTERS (clickable chips)*/}
            <div className="flex gap-4 items-center">
              <button
                type="button"
                onClick={() => { setShowNearExpiry(prev => !prev); setCurrentPage(1); }}
                className={`relative pl-6 pr-4 py-1 rounded ${showNearExpiry ? 'bg-[#FFF3C1] text-gray-900' : 'bg-white text-gray-700 hover:bg-yellow-50'} border border-gray-200`}
              >
                <span className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#FFF3C1]" />
                Near Expiry
              </button>

              <button
                type="button"
                onClick={() => { setShowExpired(prev => !prev); setCurrentPage(1); }}
                className={`relative pl-6 pr-4 py-1 rounded ${showExpired ? 'bg-[#FF3131] text-white' : 'bg-white text-gray-700 hover:bg-red-50'} border border-gray-200`}
              >
                <span className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#FF3131]" />
                Expired
              </button>

              {/* YEAR & MONTH FILTERS */}
              <div className="flex items-center gap-2 ml-4">
                <select
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
                  className="h-9 px-2 border rounded-md text-sm"
                >
                  <option value="">All Years</option>
                  {
                    // derive years from DB `year` column
                    Array.from(new Set(productValidityList.map(v => v.year).filter(Boolean)))
                      .sort((a,b) => b - a)
                      .map(y => <option key={y} value={y}>{y}</option>)
                  }
                </select>

                <select
                  value={selectedMonth}
                  onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }}
                  className="h-9 px-2 border rounded-md text-sm"
                >
                  <option value="">All Months</option>
                  {
                    // derive months from DB `month` column and map to short names
                    (() => {
                      const monthNames = [null,'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      const months = Array.from(new Set(productValidityList.map(v => v.month).filter(m => m != null).map(Number))).sort((a,b) => a - b);
                      return months.map(m => (
                        <option key={m} value={m}>{monthNames[m] || m}</option>
                      ));
                    })()
                  }
                </select>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        <div className="overflow-x-auto  overflow-y-auto h-[560px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className={`w-full ${currentPageData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200  text-sm`}>
            <thead className="sticky top-0 bg-gray-100 z-10">
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
                  <NoInfoFound col={5}/>
                  ) :

                  (
                    currentPageData.map((validity, index) => (
                      <tr
                        key={index}
                        className={
                          validity.expy
                            ? 'bg-[#FF3131] text-white hover:bg-[#FF3131]/90 h-14'
                            : validity.near_expy
                            ? 'bg-[#FFF3C1] hover:bg-yellow-100 h-14'
                            : 'hover:bg-gray-200/70 h-14'
                        }
                      >
                        {(validity.expy || validity.near_expy) ? 
                        
                            ( <td className="flex px-4 py-2 text-center gap-x-10 items-center mt-[5%]"  >
                              
                                  <div className='flex items-center'>
                                    <RiErrorWarningLine className='h-[100%]'/>
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
      <div className='flex justify-between items-center mt-4 px-3'>
        {/* LEFT: ITEM COUNT */}
        <div className='text-sm text-gray-600 flex-1'>
          {filteredValidityData.length > 0 ? (
            <>Showing {startIndex + 1} to {Math.min(endIndex, filteredValidityData.length)} of {filteredValidityData.length} items</>
          ) : (
            <span></span>
          )}
        </div>
        
        {/* CENTER: PAGINATION CONTROLS */}
        <div className='flex justify-center flex-1'>
          {filteredValidityData.length > 0 && (
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className='px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
              >
                Previous
              </button>
              <span className='text-sm text-gray-600'>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className='px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
              >
                Next
              </button>
            </div>
          )}
        </div>
        
        {/* RIGHT: EXPORT DROPDOWN */}
        <div className='flex justify-end flex-1'>
          <div className="relative group">
            <button className='bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-md transition-all flex items-center gap-2'>
              <TbFileExport />EXPORT
            </button>
            <div className="absolute right-0 bottom-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
              <button 
                onClick={() => handleExportValidity('csv')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
              >
                Export as CSV
              </button>
              <button 
                onClick={() => handleExportValidity('pdf')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
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