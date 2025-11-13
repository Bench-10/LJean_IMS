import React, { useEffect, useState, useRef, useCallback } from 'react'
import NoInfoFound from '../components/common/NoInfoFound';
import { useAuth } from '../authentication/Authentication';
import ViewingSalesAndDelivery from '../components/ViewingSalesAndDelivery';
import { TbTruckDelivery } from "react-icons/tb";
import ChartLoading from '../components/common/ChartLoading';



const DELIVERY_STORAGE_KEY = 'pendingNavigateToDelivery';

function DeliveryMonitoring({ setAddDelivery, deliveryData, sanitizeInput, deliveryEdit, deliveryLoading }) {

  const [search, setSearchDelivery] = useState('');

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // SHOW 50 ITEMS PER PAGE
  const rowRefs = useRef({});
  const tableContainerRef = useRef(null);
  const navigationTargetRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const [highlightedDeliveryId, setHighlightedDeliveryId] = useState(null);
  const [pendingHighlightDeliveryId, setPendingHighlightDeliveryId] = useState(null);

  const { user } = useAuth();

  //THIS IS TO OPEN THE DETAILED INFORMATION FOR ITEMS IN DELIVERIES
  const [openDeliveryInfo, setOpeneliveryInfo] = useState(false);
  const [modalType, setModalType] = useState("");


  //HEADER INFORMATION FOR DELIVERY
  const [deliveryInfoData, setDeliveryInfoData] = useState({
    delivery_id: '',
    courier_name: '',
    sale_id: '',
    address: '',
    date: '',
    isForDelivery: true,
    isDelivered: false,
    isPending: false
  });

  //VIEW THE PRUDUCTS UNDER SALE ID
  const openDetailes = async (Info) => {

    setDeliveryInfoData({
      delivery_id: Info.delivery_id,
      courier_name: Info.courier_name,
      sale_id: Info.sales_information_id,
      address: Info.destination_address,
      date: Info.formated_delivered_date,
      isForDelivery: true,
      isDelivered: Boolean(Info.is_delivered),
      isPending: Boolean(Info.is_pending)
    });

    setOpeneliveryInfo(true);

  };

  const closeDeliveryProducts = () => {
    setOpeneliveryInfo(false);
    setModalType("")

    setDeliveryInfoData({
      delivery_id: '',
      courier_name: '',
      sale_id: '',
      address: '',
      date: '',
      isForDelivery: true,
      isDelivered: false,
      isPending: false
    });

  };



  const handleSearch = (event) => {
    setSearchDelivery(sanitizeInput(event.target.value));
    setCurrentPage(1); // RESET TO FIRST PAGE WHEN SEARCHING
  }


  //SEARCHING THE ENTIRE LIST OD DELIVERY DATA
  let deliveryInformation = Array.isArray(deliveryData) ? deliveryData : [];

  const filteredData = deliveryInformation.filter(data =>

    String(data.delivery_id).toLowerCase().includes(search.toLowerCase()) ||
    String(data.sales_information_id).toLowerCase().includes(search.toLowerCase()) ||
    String(data.destination_address).toLowerCase().includes(search.toLowerCase()) ||
    String(data.courier_name).toLowerCase().includes(search.toLowerCase()) ||
    String(data.formated_delivered_date).toLowerCase().includes(search.toLowerCase())

  );

  // PAGINATION LOGIC
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  rowRefs.current = {};

  const attemptNavigationFocus = useCallback(() => {
    const target = navigationTargetRef.current;
    if (!target) return;

    if (search !== '') return;

    const deliveries = Array.isArray(deliveryData) ? deliveryData : [];
    if (!deliveries.length) return;

    let targetIndex = -1;

    if (target.deliveryId !== null && target.deliveryId !== undefined) {
      targetIndex = deliveries.findIndex(
        (record) => Number(record.delivery_id) === Number(target.deliveryId)
      );
    }

    if (targetIndex === -1 && target.saleId !== null && target.saleId !== undefined) {
      targetIndex = deliveries.findIndex(
        (record) => Number(record.sales_information_id) === Number(target.saleId)
      );
    }

    if (targetIndex === -1) return;

    const targetPage = Math.floor(targetIndex / itemsPerPage) + 1;

    if (currentPage !== targetPage) {
      setCurrentPage(targetPage);
      return;
    }

    const targetRecord = deliveries[targetIndex];
    const highlightId = target.deliveryId !== null && target.deliveryId !== undefined
      ? Number(target.deliveryId)
      : Number(targetRecord?.delivery_id);

    if (!Number.isFinite(highlightId)) return;

    setPendingHighlightDeliveryId(highlightId);
    navigationTargetRef.current = null;
  }, [deliveryData, search, itemsPerPage, currentPage]);

  useEffect(() => {
    attemptNavigationFocus();
  }, [attemptNavigationFocus, deliveryData, search, currentPage]);

  useEffect(() => {
    const handleNavigateToDeliveryRow = (event) => {
      const detail = event.detail || {};
      const deliveryId = detail.deliveryId !== undefined && detail.deliveryId !== null ? Number(detail.deliveryId) : null;
      const saleId = detail.saleId !== undefined && detail.saleId !== null ? Number(detail.saleId) : null;

      if (deliveryId === null && saleId === null) return;

      try {
        // clear any persisted pending navigation for delivery since we're handling it now
        sessionStorage.removeItem('pendingNavigateToDelivery');
      } catch (e) { /* ignore non-browser env */ }

      navigationTargetRef.current = {
        deliveryId,
        saleId,
        highlightContext: detail.highlightContext ?? null
      };

      setOpeneliveryInfo(false);
      setModalType("");

      setSearchDelivery((prev) => (prev === '' ? prev : ''));

      attemptNavigationFocus();
    };

    window.addEventListener('navigate-to-delivery-row', handleNavigateToDeliveryRow);

    // Consume pending navigation fired before this component mounted (if any)
    try {
      const pending = sessionStorage.getItem('pendingNavigateToDelivery');
      if (pending) {
        const parsed = JSON.parse(pending);
        const deliveryId = parsed.deliveryId !== undefined && parsed.deliveryId !== null ? Number(parsed.deliveryId) : null;
        const saleId = parsed.saleId !== undefined && parsed.saleId !== null ? Number(parsed.saleId) : null;

        if (deliveryId !== null || saleId !== null) {
          navigationTargetRef.current = {
            deliveryId,
            saleId,
            highlightContext: parsed.highlightContext ?? null
          };

          sessionStorage.removeItem('pendingNavigateToDelivery');

          attemptNavigationFocus();
        }
      }
    } catch (e) { /* ignore non-browser env */ }
    return () => {
      window.removeEventListener('navigate-to-delivery-row', handleNavigateToDeliveryRow);
    };
  }, [attemptNavigationFocus]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DELIVERY_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (!parsed || (parsed.deliveryId == null && parsed.saleId == null)) {
        sessionStorage.removeItem(DELIVERY_STORAGE_KEY);
        return;
      }

      navigationTargetRef.current = {
        deliveryId: parsed.deliveryId != null ? Number(parsed.deliveryId) : null,
        saleId: parsed.saleId != null ? Number(parsed.saleId) : null,
        highlightContext: parsed.highlightContext ?? null
      };

      sessionStorage.removeItem(DELIVERY_STORAGE_KEY);
      attemptNavigationFocus();
    } catch (error) {
      console.error('Failed to parse pending delivery navigation', error);
      sessionStorage.removeItem(DELIVERY_STORAGE_KEY);
    }
  }, [attemptNavigationFocus]);

  useEffect(() => () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
  }, []);

  // Smoothly center the highlighted delivery row without shifting the page banner
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

  useEffect(() => {
    if (pendingHighlightDeliveryId === null) return;

    const rowElement = rowRefs.current[pendingHighlightDeliveryId];
    if (!rowElement) return;

    scrollRowIntoView(rowElement);
    setHighlightedDeliveryId(pendingHighlightDeliveryId);
    setPendingHighlightDeliveryId(null);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedDeliveryId(null);
    }, 2000);
  }, [currentPageData, pendingHighlightDeliveryId, scrollRowIntoView]);


  return (
    <div className="pt-20 lg:pt-7 px-4 lg:px-8 h-screen" >

      <ViewingSalesAndDelivery
        openModal={openDeliveryInfo}
        type={modalType}
        closeModal={() => closeDeliveryProducts()}
        user={user}
        headerInformation={deliveryInfoData}
        sale_id={deliveryInfoData.sale_id}

      />

      {/*TITLE*/}
      <h1 className='text-[33px] leading-[36px] font-bold text-green-900'>
        DELIVERY
      </h1>

      <hr className="mt-3 mb-6 border-t-4 border-green-800" />

      {/*SEARCH AND ADD*/}
      <div className='lg:flex '>
        <div className='flex lg:gap-x-9'>
          {/*SEARCH */}
          <div className='w-[100vw] lg:w-[400px] text-sm lg:text-sm lg:pb-0 pb-3'>

            <input
              type="text"
              placeholder="Search Delivery Data"
              className="border outline outline-1 outline-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all px-3 py-0 rounded-lg w-full h-9 leading-none align-middle"
              onChange={handleSearch}

            />

          </div>

        </div>



        <div className="ml-auto flex gap-4">
          {/*APPEAR ONLY IF THE USER ROLE IS SALES ASSOCIATE */}
          {user && user.role && user.role.some(role => ['Sales Associate'].includes(role)) && (
            <button
              className='flex items-center gap-x-3 w-full lg:w-auto justify-center bg-[#119200] text-sm text-white font-medium hover:bg-[#56be48] px-5 py-2 rounded-lg transition-all'
              onClick={() => {
                requestAnimationFrame(() => {
                  setAddDelivery(true);
                });
              }}
            >
              <TbTruckDelivery />
              ADD DELIVERY
            </button>
          )}
        </div>


      </div>

      <hr className="border-t-2 my-4 w-full border-gray-500" />

      {/*TABLE */}

      <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto h-[60vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6">
        <table className={`w-full ${!currentPageData || currentPageData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200 text-sm`}>
          <thead className="sticky top-0 z-10">
            <tr>

              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white ">
                ID
              </th>

              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white ">
                COURIER NAME
              </th>

              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white">
                SALE ID
              </th>

              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white ">
                DESTINATION ADDRESS
              </th>

              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white ">
                DELIVERY DATE
              </th>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white ">
                STATUS
              </th>



            </tr>
          </thead>


          <tbody className="bg-white relative">
            {deliveryLoading ?
              (
                <tr>
                  <td colSpan={6}>
                    <ChartLoading message='Loading delivery data...' />
                  </td>
                </tr>
              )

              :

              (!currentPageData || currentPageData.length === 0 ?
                (
                  <NoInfoFound col={6} />
                ) :

                  (
                    currentPageData.map((row, idx) => {
                      const deliveryIdValue = Number(row.delivery_id);
                      const isHighlighted = highlightedDeliveryId === deliveryIdValue;

                      return (
                        <tr
                          key={deliveryIdValue || idx}
                          ref={(el) => {
                            if (!Number.isFinite(deliveryIdValue)) return;
                            if (el) {
                              rowRefs.current[deliveryIdValue] = el;
                            } else {
                              delete rowRefs.current[deliveryIdValue];
                            }
                          }}
                          className={`hover:bg-gray-200/70 h-14 ${(idx + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""} transition-colors duration-300 ease-in-out ${isHighlighted ? 'bg-green-200' : ''}` }
                          onClick={() => {openDetailes(row); setModalType("other")}}
                        >
                          <td className="px-4 py-2 text-left">{row.delivery_id}</td>
                          <td className="px-4 py-2 font-medium whitespace-nowrap text-left">{row.courier_name}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-left">{row.sales_information_id}</td>
                          <td className="px-4 py-2 text-left">{row.destination_address}</td>
                          <td className="px-4 py-2 text-left">{row.formated_delivered_date}</td>
                          <td className="px-4 py-2 text-center">
                            <button
                              className={`${row.is_pending ? 'bg-amber-400 text-white' : row.is_delivered ? 'border-2 border-green-700/70 text-green-700/70 font-semibold' : 'border-2 border-red-700/70 text-red-700/70 font-semibold'} rounded-md px-4 py-2 transition-colors`}
                              onClick={(e) => {
                                e.stopPropagation();
                                requestAnimationFrame(() => {
                                  deliveryEdit('edit', row);
                                });
                              }}
                            >
                              {row.is_pending ? 'Delivering...' : row.is_delivered ? 'Delivered' : 'Undelivered'}
                            </button>
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
        <div className="hidden sm:relative sm:flex sm:items-center w-full pb-6">

          {/* LEFT: ITEM COUNT */}
          <div className="text-[13px] text-gray-600">
            {filteredData.length > 0 ? (
              <>Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} items</>
            ) : (
              <span></span>
            )}
          </div>

          {/* CENTER: PAGINATION CONTROLS */}
          {filteredData.length > 0 && (
            <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2 flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-[13px] border rounded-lg bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Previous 
              </button>
              <span className="text-[13px] text-gray-600 whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-[13px] border rounded-lg bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
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

export default DeliveryMonitoring

