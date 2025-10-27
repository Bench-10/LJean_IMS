import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BsTelephoneFill } from "react-icons/bs";
import { RiCellphoneFill } from "react-icons/ri";
import { MdEmail, MdOutlineCorporateFare } from "react-icons/md";

import NoInfoFound from './common/NoInfoFound';
import api from '../utils/api';
import { currencyFormat } from '../utils/formatCurrency';
import ChartLoading from './common/ChartLoading';
import { exportElementAsPDF } from '../utils/exportUtils';

function ViewingSalesAndDelivery({ openModal, closeModal, user, type, headerInformation, sale_id }) {
  const [soldItems, setSoldItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const contentRef = useRef(null);

  const statusDetails = useMemo(() => {
    if (!headerInformation) return null;

    const isForDelivery = Boolean(headerInformation.isForDelivery);
    const isDelivered = Boolean(headerInformation.isDelivered);
    const isPending = Boolean(headerInformation.isPending);

    if (!isForDelivery) {
      return {
        label: 'Counter Sale',
        description: 'This transaction is not marked for delivery.',
        containerClass: 'border border-gray-200 bg-gray-100',
        labelClass: 'text-gray-700',
        showDeliveryTag: false
      };
    }

    if (isDelivered) {
      return {
        label: 'Delivered',
        description: 'Delivery has been completed successfully.',
        containerClass: 'border border-green-200 bg-green-50',
        labelClass: 'text-green-700',
        showDeliveryTag: true
      };
    }

    if (isPending) {
      return {
        label: 'Out for Delivery',
        description: 'Order has been dispatched and is currently out for delivery.',
        containerClass: 'border border-sky-200 bg-sky-50',
        labelClass: 'text-sky-700',
        showDeliveryTag: true
      };
    }

    return {
      label: 'Undelivered',
      description: 'Delivery was unsuccessful or cancelled.',
      containerClass: 'border border-red-200 bg-red-50',
      labelClass: 'text-red-700',
      showDeliveryTag: true
    };
  }, [headerInformation]);

  useEffect(() => {
    if (!sale_id) return;
    items();
  }, [openModal]);

  const items = async () => {
    try {
      setLoading(true);
      const soldItems = await api.get(`/api/sale_items?sale_id=${sale_id}`);
      setSoldItems(soldItems.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!contentRef.current || !headerInformation) return;
    try {
      setExporting(true);
      const baseFilename = type === 'sales'
        ? `sale-${headerInformation.sale_id || 'transaction'}`
        : `delivery-${headerInformation.delivery_id || headerInformation.sale_id || 'transaction'}`;
      await exportElementAsPDF(contentRef.current, baseFilename);
    } catch (error) {
      console.error('Failed to export transaction details:', error);
    } finally {
      setExporting(false);
    }
  };

  if (!user) return null;

  return (
    <div>
      {openModal && (
        <div
          className="fixed inset-0 bg-black/35 z-[9998] backdrop-blur-sm"
          onClick={closeModal}
        />
      )}

      <dialog className="bg-transparent fixed top-0 bottom-0 z-[9999]" open={openModal}>
        <div className="relative flex flex-col border border-gray-600/40 bg-white h-[95vh] sm:h-[90vh] w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[1100px] max-h-none sm:max-h-[700px] rounded-lg py-2 sm:py-3 md:py-5 px-2 sm:px-3 animate-popup overflow-hidden overflow-y-auto hide-scrollbar">
          
          <button
            type='button'
            className="absolute right-2 top-2 z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 font-bold"
            onClick={closeModal}
          >
            ✕
          </button>

          <div className="pb-4 pt-2 px-3 sm:px-4 md:px-8 w-full flex-1 flex flex-col">
            
            {/* SALE HEADERS SECTION */}
            <div className="mb-4">
              
              {/* HEADER INFORMATION */}
              <div>
                {/* TITLES */}
                <div className='flex flex-col text-center gap-y-2 sm:gap-y-3 md:gap-y-4'>
                  <div className='text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-green-900'>
                    {user.branch_name.toUpperCase()}
                  </div>

                  <div className='text-sm sm:text-base md:text-lg lg:text-xl font-semibold px-2'>
                    {user.address}
                  </div>

                  <div className='flex flex-wrap justify-center gap-x-3 gap-y-2 sm:gap-x-4 md:gap-x-5 text-xs sm:text-sm px-2'>
                    <div className='flex items-center gap-x-1 sm:gap-x-2'>
                      <BsTelephoneFill className="flex-shrink-0" />
                      <span className="break-all">{user.telephone_num}</span>
                    </div>

                    <div className='flex items-center gap-x-1 sm:gap-x-2'>
                      <RiCellphoneFill className="flex-shrink-0" />
                      <span className="break-all">{user.cellphone_num}</span>
                    </div>

                    <div className='flex items-center gap-x-1 sm:gap-x-2'>
                      <MdEmail className="flex-shrink-0" />
                      <span className="break-all">{user.branch_email}</span>
                    </div>

                    <div className='flex items-center gap-x-1 sm:gap-x-2'>
                      <MdOutlineCorporateFare className="flex-shrink-0" />
                      <span className="whitespace-nowrap">VAT Reg. TIN 186-705-637-000</span>
                    </div>
                  </div>
                </div>

                <h2 className="text-sm sm:text-base md:text-md font-bold mt-4 sm:mt-5 mb-2 sm:mb-3 text-gray-700 border-b pb-2">
                  {type === "sales" ? "CHARGE SALES INVOICE" : "DELIVERY DETAILS"}
                </h2>
              </div>
              
              <p className='text-xs sm:text-sm mb-2 sm:mb-3'>
                Person In-charge: <span className='font-bold italic'>{headerInformation.transactionBy}</span>
              </p>

              {statusDetails && (
                <div className={`mb-3 sm:mb-4 rounded-md px-3 sm:px-4 py-2 sm:py-3 text-sm shadow-sm ${statusDetails.containerClass}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm sm:text-base font-semibold ${statusDetails.labelClass}`}>
                      {statusDetails.label}
                    </span>
                  </div>
                  {statusDetails.description && (
                    <p className="mt-1 text-xs text-gray-600">{statusDetails.description}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div>
                  <label className="text-xs font-bold text-gray-600">SALE ID</label>
                  <div className="p-2 bg-gray-50 border rounded text-xs sm:text-sm break-all">
                    {headerInformation.sale_id}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600">DATE</label>
                  <div className="p-2 bg-gray-50 border rounded text-xs sm:text-sm">
                    {headerInformation.date}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600">
                    {type === "sales" ? "CHARGE TO" : "DELIVERY ID"}
                  </label>
                  <div className="p-2 bg-gray-50 border rounded text-xs sm:text-sm break-all">
                    {type === "sales" ? headerInformation.chargeTo : headerInformation.delivery_id}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600">
                    {type === "sales" ? "TIN" : "COURIER NAME"}
                  </label>
                  <div className="p-2 bg-gray-50 border rounded text-xs sm:text-sm break-all">
                    {type === "sales" ? headerInformation.tin : headerInformation.courier_name}
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="text-xs font-bold text-gray-600">ADDRESS</label>
                  <div className="p-2 bg-gray-50 border rounded text-xs sm:text-sm">
                    {headerInformation.address}
                  </div>
                </div>
              </div>
            </div>

            {/* SOLD ITEMS SECTION */}
            <div className="flex-1 flex flex-col min-h-0">
              <h2 className="text-sm sm:text-base font-semibold mb-2 text-gray-700 border-b pb-1">
                {type === "sales" ? "Items Sold" : "Products To Deliver"}
              </h2>
              
              {/* Mobile: Card view */}
              <div className="block sm:hidden space-y-2 overflow-auto mb-2">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-green-600 rounded-full"></div>
                    <span className="text-sm text-gray-600 mt-2">Loading sales information...</span>
                  </div>
                ) : (!soldItems || soldItems.length === 0) ? (
                  <div className="text-center py-8 text-gray-500">No information found</div>
                ) : (
                  soldItems.map((item, itemIndex) => (
                    <div key={itemIndex} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                      <div className="font-medium text-sm mb-2">{item.product_name}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Quantity:</span>
                          <div className="font-semibold">{item.quantity.toLocaleString()} {item.unit}</div>
                        </div>
                        {type === "sales" && (
                          <>
                            <div>
                              <span className="text-gray-600">Unit Price:</span>
                              <div className="font-semibold">{currencyFormat(item.unit_price)}</div>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-600">Amount:</span>
                              <div className="font-semibold text-green-700">{currencyFormat(item.amount)}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop: Table view */}
              <div className="hidden sm:block h-50 overflow-auto border border-gray-200 mb-2 rounded-lg shadow-sm">
                <table className="w-full divide-y divide-gray-200 text-sm">
                  <thead className="sticky top-0 bg-gray-100 shadow-sm">
                    <tr>
                      <th className="px-2 md:px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                        PRODUCT NAME
                      </th>
                      <th className="px-2 md:px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                        QUANTITY
                      </th>
                      <th className="px-2 md:px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                        UNIT
                      </th>
                      {type === "sales" && (
                        <>
                          <th className="px-2 md:px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                            UNIT PRICE
                          </th>
                          <th className="px-2 md:px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                            AMOUNT
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <ChartLoading asTableRow={true} colSpan={type === "sales" ? 5 : 3} message="Loading sales information..." />
                    ) : (!soldItems || soldItems.length === 0) ? (
                      <NoInfoFound col={type === "sales" ? 5 : 3} />
                    ) : (
                      soldItems.map((item, itemIndex) => (
                        <tr key={itemIndex} className="hover:bg-gray-50 text-xs sm:text-sm">
                          <td className="px-2 md:px-3 py-2 text-left">{item.product_name}</td>
                          <td className="px-2 md:px-3 py-2 text-center">{item.quantity.toLocaleString()}</td>
                          <td className="px-2 md:px-3 py-2 text-center">{item.unit}</td>
                          {type === "sales" && (
                            <>
                              <td className="px-2 md:px-3 py-2 text-right">{currencyFormat(item.unit_price)}</td>
                              <td className="px-2 md:px-3 py-2 text-right">{currencyFormat(item.amount)}</td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AMOUNTS SECTION (ONLY FOR SALES) */}
            {type === "sales" && (
              <div className="border-t pt-3 sm:pt-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  
                  {/* Summary Details - Full width on mobile, left side on desktop */}
                  <div className="flex-1 order-2 lg:order-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">Summary Details</h3>
                    
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs sm:text-sm text-gray-600 mb-2">
                        This transaction was completed successfully. The total amount includes VAT and all applicable taxes.
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Please keep this record for your reference.
                      </p>
                    </div>

                    <div className="mt-3 flex">
                      <button
                        type="button"
                        onClick={handleExport}
                        disabled={loading || exporting}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-600 rounded-md shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {exporting ? (
                          <>
                            <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <span>Export PDF</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Financial Summary - Full width on mobile, right side on desktop */}
                  <div className="w-full lg:w-[400px] bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200 order-1 lg:order-2">
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between py-2 border-b border-gray-200 text-sm sm:text-base">
                        <span className="font-medium text-gray-600">Amount Net VAT:</span>
                        <span className="font-semibold">{currencyFormat(headerInformation.amountNet)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200 text-sm sm:text-base">
                        <span className="font-medium text-gray-600">VAT (10%):</span>
                        <span className="font-semibold">{currencyFormat(headerInformation.vat)}</span>
                      </div>
                      {(headerInformation.discount !== undefined && headerInformation.discount > 0) && (
                        <div className="flex justify-between py-2 border-b border-gray-200 text-sm sm:text-base">
                          <span className="font-medium text-amber-600">Discount:</span>
                          <span className="font-semibold text-amber-600">-{currencyFormat(Number(headerInformation.discount))}</span>
                        </div>
                      )}
                      {headerInformation.deliveryFee !== undefined && headerInformation.deliveryFee > 0 && (
                        <div className="flex justify-between py-2 border-b border-gray-200 text-sm sm:text-base">
                          <span className="font-medium text-blue-600">Delivery Fee:</span>
                          <span className="font-semibold text-blue-600">{currencyFormat(Number(headerInformation.deliveryFee))}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 sm:py-3 text-base sm:text-xl font-bold border-t-2 border-gray-400 mt-2">
                        <span className="text-sm sm:text-base lg:text-xl">TOTAL AMOUNT DUE:</span>
                        <span className="text-green-700 text-sm sm:text-base lg:text-xl">{currencyFormat(headerInformation.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}

export default ViewingSalesAndDelivery;
