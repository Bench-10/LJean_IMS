import { React, useEffect, useState } from 'react'
import NoInfoFound from '../components/common/NoInfoFound';
import { useAuth } from '../authentication/Authentication';
import ViewingSalesAndDelivery from '../components/ViewingSalesAndDelivery';
import { TbTruckDelivery, TbFileExport } from "react-icons/tb";
import ChartLoading from '../components/common/ChartLoading';



function DeliveryMonitoring({ setAddDelivery, deliveryData, sanitizeInput, deliveryEdit, deliveryLoading }) {

  const [search, setSearchDelivery] = useState('');

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // SHOW 50 ITEMS PER PAGE

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
  let deliveryInformation = deliveryData;

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


  return (
    <div className="pt-20 lg:pt-8 px-4 lg:px-8 h-screen" >

      <ViewingSalesAndDelivery
        openModal={openDeliveryInfo}
        type={modalType}
        closeModal={() => closeDeliveryProducts()}
        user={user}
        headerInformation={deliveryInfoData}
        sale_id={deliveryInfoData.sale_id}

      />

      {/*TITLE*/}
      <h1 className='text-4xl font-bold text-green-900'>
        DELIVERY
      </h1>

      <hr className="mt-3 mb-6 border-t-4 border-green-800" />

      {/*SEARCH AND ADD*/}
      <div className='lg:flex '>
        <div className='flex lg:gap-x-9'>
          {/*SEARCH */}
          <div className='w-[100vw] lg:w-[400px] text-sm lg:text-base lg:pb-0 pb-3'>

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
            <button className='flex items-center gap-x-3 w-full lg:w-auto justify-center bg-[#119200] text-white font-medium hover:bg-[#56be48] px-5 py-2  rounded-lg transition-all' onClick={() => setAddDelivery(true)} >
              <TbTruckDelivery />
              ADD DELIVERY
            </button>
          )}

        </div>


      </div>

      <hr className="border-t-2 my-4 w-full border-gray-500" />

      {/*TABLE */}

      <div className="overflow-x-auto overflow-y-auto h-[55vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6">
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
                  currentPageData.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-gray-200/70 h-14 ${(idx + 1) % 2 === 0 ? "bg-[#F6F6F6]" : ""}`} onClick={() => { openDetailes(row); setModalType("other") }}>
                      <td className="px-4 py-2 text-left">{row.delivery_id}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap text-left"  >{row.courier_name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-left">{row.sales_information_id}</td>
                      <td className="px-4 py-2 text-left">{row.destination_address}</td>
                      <td className="px-4 py-2 text-left">{row.formated_delivered_date}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          className={`${row.is_pending ? 'bg-amber-400 text-white' : row.is_delivered ? 'border-2 border-green-700/70 text-green-700/70 font-semibold' : 'border-2 border-red-700/70 text-red-700/70 font-semibold'} rounded-xl px-4 py-2`}
                          onClick={(e) => {
                            e.stopPropagation();
                            deliveryEdit('edit', row);
                          }}

                        >
                          {row.is_pending ? 'Delivering...' : row.is_delivered ? 'Delivered' : 'Undelivered'}
                        </button>
                      </td>

                    </tr>
                  ))

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

export default DeliveryMonitoring

