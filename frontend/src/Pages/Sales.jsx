import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../authentication/Authentication';
import NoInfoFound from '../components/common/NoInfoFound.jsx';
import ChartLoading from '../components/common/ChartLoading.jsx';
import {currencyFormat} from '../utils/formatCurrency.js';
import ViewingSalesAndDelivery from '../components/ViewingSalesAndDelivery.jsx';
import { FaCashRegister } from "react-icons/fa6";
import DropdownCustom from '../components/DropdownCustom';

function Sales({setOpenSaleModal, saleHeader, sanitizeInput, salesLoading}) {

  const {user} = useAuth();

  //THIS IS TO OPEN THE DETAILED INFORMATION FOR SALES
  const [openItems, setOpenSoldItems] = useState(false);
  const [modalType, setModalType] = useState("");

  const [searchSale, setSearchSale] = useState('');
  const [saleFilter, setSaleFilter] = useState('all');

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // SHOW 50 ITEMS PER PAGE
  const rowRefs = useRef({});
  const tableContainerRef = useRef(null);
  const navigationTargetRef = useRef(null);
  const ignoreFilterResetRef = useRef(false);
  const highlightTimeoutRef = useRef(null);

  const [highlightedSaleId, setHighlightedSaleId] = useState(null);
  const [pendingHighlightSaleId, setPendingHighlightSaleId] = useState(null);

  // RESET PAGINATION WHEN FILTER CHANGES (SKIP DURING PROGRAMMATIC NAVIGATION)
  useEffect(() => {
    if (ignoreFilterResetRef.current) {
      ignoreFilterResetRef.current = false;
      return;
    }
    setCurrentPage(1);

  }, [saleFilter]);

  // Smoothly center the highlighted row within the virtualized table viewport
  const scrollRowIntoView = useCallback((rowElement) => {
    if (!rowElement) return;

    const container = tableContainerRef.current;
    if (!container) {
      requestAnimationFrame(() => scrollRowIntoView(rowElement));
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const rowRect = rowElement.getBoundingClientRect();
    const offset = (rowRect.top - containerRect.top) - ((container.clientHeight - rowElement.clientHeight) / 2);
    const targetScrollTop = container.scrollTop + offset;

    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
  }, []);

  //HEADER AND TOTAL INFORMATION
  const [saleData, setSaleData ] = useState({
    sale_id: '',
    chargeTo: '',
    tin: '',
    date: '',
    amountNet: '',
    vat: '',
    total: '',
    discount: 0,
    transactionBy: '',
    deliveryFee: 0,
    isForDelivery: false,
    isDelivered: false,
    isPending: false
  });

  //VIEW THE PRUDUCTS UNDER SALE ID
  const openSoldItems = async (sailInfo) =>{

    setSaleData({
      sale_id: sailInfo.sales_information_id,
      chargeTo: sailInfo.charge_to, 
      tin: sailInfo.tin, 
      address: sailInfo.address, 
      date: sailInfo.formated_date,
      amountNet: sailInfo.amount_net_vat, 
      vat: sailInfo.vat, 
      total: sailInfo.total_amount_due,
      discount: sailInfo.discount,
      transactionBy: sailInfo.transaction_by,
      deliveryFee: sailInfo.delivery_fee,
      isForDelivery: Boolean(sailInfo.is_for_delivery),
      isDelivered: Boolean(sailInfo.is_delivered),
      isPending: Boolean(sailInfo.is_pending)

    });

    setOpenSoldItems(true);

  };

  const closeViewingProducts = () => {
    setOpenSoldItems(false);
    setModalType("")
  
    setSaleData({
      sale_id: '', 
      chargeTo: '', 
      tin: '', 
      address: '', 
      date: '',
      amountNet: '', 
      vat: '', 
      total: '',
      discount: 0,
      transactionBy: '',
  deliveryFee: 0,
  isForDelivery: false,
  isDelivered: false,
  isPending: false
    });

  };

  //SEARCH SALE INFORMATION
  const handleSaleSearch = (event) =>{
    setSearchSale(sanitizeInput(event.target.value));
    setCurrentPage(1); // RESET TO FIRST PAGE WHEN SEARCHING
  };

  // FILTER & PAGINATE SALES
  let filteredSale = Array.isArray(saleHeader) ? saleHeader : [];
  if (saleFilter === 'normal') {
    filteredSale = filteredSale.filter(sale => !sale.is_for_delivery);

  } else if (saleFilter === 'delivered') {
    filteredSale = filteredSale.filter(sale => sale.is_for_delivery && sale.is_delivered && !sale.is_pending);

  } else if (saleFilter === 'undelivered') {
    filteredSale = filteredSale.filter(sale => sale.is_for_delivery && !sale.is_delivered && !sale.is_pending);

  } else if (saleFilter === 'out_for_delivery') {
    filteredSale = filteredSale.filter(sale => sale.is_for_delivery && !sale.is_delivered && sale.is_pending);

  }

  const filteredData = filteredSale.filter(sale => 
    sale.charge_to?.toLowerCase().includes(searchSale.toLowerCase()) ||
    sale.tin?.toLowerCase().includes(searchSale.toLowerCase()) ||
    sale.address?.toLowerCase().includes(searchSale.toLowerCase()) 
  );

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  rowRefs.current = {};

  const attemptNavigationFocus = useCallback(() => {
    const target = navigationTargetRef.current;
    if (!target || !target.saleId) return;

    if (saleFilter !== 'all') return;
    if (searchSale !== '') return;

    const salesList = Array.isArray(saleHeader) ? saleHeader : [];
    if (!salesList.length) return;

    const saleIndex = salesList.findIndex(
      (sale) => Number(sale.sales_information_id) === Number(target.saleId)
    );

    if (saleIndex === -1) return;

    const targetPage = Math.floor(saleIndex / itemsPerPage) + 1;

    if (currentPage !== targetPage) {
      setCurrentPage(targetPage);
      return;
    }

    setPendingHighlightSaleId(Number(target.saleId));
    navigationTargetRef.current = null;
  }, [saleHeader, saleFilter, searchSale, itemsPerPage, currentPage]);

  useEffect(() => {
    attemptNavigationFocus();
  }, [attemptNavigationFocus, saleHeader, currentPage, saleFilter, searchSale]);

  useEffect(() => {
    const handleNavigateToSaleRow = (event) => {
      const detail = event.detail || {};
      if (!detail.saleId) return;

      navigationTargetRef.current = {
        saleId: Number(detail.saleId),
        highlightContext: detail.highlightContext ?? null
      };

      setOpenSoldItems(false);
      setModalType("");

      setSearchSale((prev) => (prev === '' ? prev : ''));

      setSaleFilter((prev) => {
        if (prev === 'all') return prev;
        ignoreFilterResetRef.current = true;
        return 'all';
      });

      attemptNavigationFocus();
    };

    window.addEventListener('navigate-to-sale-row', handleNavigateToSaleRow);

    return () => {
      window.removeEventListener('navigate-to-sale-row', handleNavigateToSaleRow);
    };
  }, [attemptNavigationFocus]);

  useEffect(() => () => {
    if (highlightTimeoutRef.current) {
      scrollRowIntoView(rowElement);
    }
  }, []);

  useEffect(() => {
    if (pendingHighlightSaleId === null) return;

    const rowElement = rowRefs.current[pendingHighlightSaleId];

    if (!rowElement) return;

    rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedSaleId(pendingHighlightSaleId);
    setPendingHighlightSaleId(null);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedSaleId(null);
    }, 6000);
  }, [currentPageData, pendingHighlightSaleId, scrollRowIntoView]);

  return (
    <div className='pt-20 lg:pt-8 px-4 lg:px-8 h-screen'>

      <ViewingSalesAndDelivery 
        openModal={openItems}
        type={modalType}
        closeModal={() => closeViewingProducts()} 
        user={user}
        headerInformation={saleData}
        sale_id={saleData.sale_id}
        currencyFormat={currencyFormat}

      />
        

        <h1 className=' text-4xl font-bold text-green-900'>
          SALES TRANSACTIONS
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800 rounded-lg"/>

        {/*SEARCH AND ADD*/}
        <div className='lg:flex gap-4 lg:gap-9 ' >
          {/*SEARCH */}
          <div className='w-full lg:w-[400px] text-sm lg:text-base pb-4 lg:pb-0'>
            <input
              type="text"
              placeholder="Search"
              className="border outline outline-1 outline-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:py-2 transition-all px-3 py-2 rounded-lg w-full h-9"
              onChange={handleSaleSearch}
            />
          </div>

          {/* DROPDOWN FILTER */}
<DropdownCustom
  value={saleFilter}
  onChange={e => setSaleFilter(e.target.value)}
  label="Sale Type"
  variant="floating"
  options={[
    { value: 'all', label: 'All Sales' },
    { value: 'normal', label: 'Normal Sales' },
    { value: 'for_delivery', label: 'For Delivery Sales' },
    { value: 'delivered', label: 'Delivered Sales' },
    { value: 'undelivered', label: 'Undelivered Sales' },
    { value: 'out_for_delivery', label: 'Out for Delivery Sales' }
  ]}
/>

          {/*APPEAR ONLY IF THE USER ROLE IS SALES ASSOCIATE */}
          {user && user.role && user.role.some(role => ['Sales Associate'].includes(role)) &&
            <div className="lg:pt-0 pt-3 ml-auto flex gap-4">
              {/*ADD SALE BTN*/}
              <button className='flex items-center justify-center gap-x-3 bg-[#119200] text-white font-medium hover:bg-[#56be48] w-full lg:w-auto px-5 py-2 rounded-lg transition-all'  onClick={() => setOpenSaleModal(true)}> 
                <FaCashRegister /> ADD SALE
              </button>
            </div>
          }
        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500 rounded-lg"/>

  <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto h-[55vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6">
        <table className={`w-full ${currentPageData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200 text-sm`}>
          <thead className="sticky top-0 z-10">
              <tr>
                
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-24">
                    SALE ID
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">
                    CHARGE TO
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">
                    TIN
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">
                    ADDRESS
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-32">
                    DATE
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                    AMOUNT NET VAT
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-28">
                    VAT
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-28">
                    TOTAL AMOUNT
                  </th>

              </tr>
            </thead>

            
            <tbody className="bg-white relative">
              {salesLoading ? 
                (
                 <tr>
                  <td colSpan={5}>
                    <ChartLoading message='Loading sales records...' />
                  </td>
                 </tr>
                
                )
               :
              
                currentPageData.length === 0 ? 
                  (
                    <NoInfoFound col={9}/>
                  ) : 

                  (
                    currentPageData.map((row, rowIndex) => {
                      const saleIdValue = Number(row.sales_information_id);
                      const isHighlighted = highlightedSaleId === saleIdValue;

                      return (
                        <tr
                          key={saleIdValue || rowIndex}
                          ref={(el) => {
                            if (!saleIdValue) return;
                            if (el) {
                              rowRefs.current[saleIdValue] = el;
                            } else {
                              delete rowRefs.current[saleIdValue];
                            }
                          }}
                          className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""} ${isHighlighted ? 'bg-green-100 border-l-4 border-green-500 ring-2 ring-green-300 shadow-inner' : ''}`}
                          onClick={() => {openSoldItems(row); setModalType("sales")}}
                        >
                        <td className="px-4 py-2 text-center"  >{row.sales_information_id}</td>
                        <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.charge_to}</td>
                        <td className="px-4 py-2 whitespace-nowrap"  >{row.tin}</td>
                        <td className="px-4 py-2"  >{row.address}</td>
                        <td className="px-4 py-2 text-right"  >{row.formated_date}</td>
                        <td className="px-4 py-2 text-right"  >{currencyFormat(row.amount_net_vat)}</td>
                        <td className="px-4 py-2 text-right"  >{currencyFormat(row.vat)}</td>
                        <td className="px-5 py-2 text-right"  >{currencyFormat(row.total_amount_due)}</td>

                        </tr>
                      );
                    })
                  ) 
              }
              
            </tbody>
          </table>
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

        {/* DESKTOP LAYOUT: LEFT + CENTER PAGINATION */}
<div className="hidden sm:relative sm:flex sm:items-center w-full mt-3 pb-6 px-3">

  {/* LEFT: ITEM COUNT */}
  <div className="text-sm text-gray-600">
    {filteredData.length > 0 ? (
      <>Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} items</>
    ) : (
      <span></span>
    )}
  </div>

  {/* CENTER: PAGINATION CONTROLS */}
  {filteredData.length > 0 && (
    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
      <button
        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm border rounded-lg bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
      >
        Previous
      </button>
      <span className="text-sm text-gray-600 whitespace-nowrap">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm border rounded-lg bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
      >
        Next
      </button>
    </div>
  )}

</div>


      </div>

    </div>
  )
}

export default Sales
