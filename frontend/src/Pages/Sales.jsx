import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../authentication/Authentication';
import NoInfoFound from '../components/common/NoInfoFound.jsx';
import ChartLoading from '../components/common/ChartLoading.jsx';
import { currencyFormat } from '../utils/formatCurrency.js';
import ViewingSalesAndDelivery from '../components/ViewingSalesAndDelivery.jsx';
import { FaCashRegister } from "react-icons/fa6";
import DropdownCustom from '../components/DropdownCustom';

function Sales({ setOpenSaleModal, saleHeader = [], sanitizeInput, salesLoading }) {
  const { user } = useAuth();

  // DIALOG STATE
  const [openItems, setOpenSoldItems] = useState(false);
  const [modalType, setModalType] = useState("");

  // FILTER + SEARCH + PAGINATION
  const [searchSale, setSearchSale] = useState('');
  const [saleFilter, setSaleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  useEffect(() => { setCurrentPage(1); }, [saleFilter]);

  const [saleData, setSaleData] = useState({
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

  const openSoldItems = async (sailInfo) => {
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
    setModalType("");
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

  const handleSaleSearch = (event) => {
    setSearchSale(sanitizeInput ? sanitizeInput(event.target.value) : event.target.value);
    setCurrentPage(1);
  };

  // --- helper: get comparable time (ms) for robust sorting ---
  const getSaleTime = (sale) => {
    const candidates = [
      sale.date,                // if your API already has date
      sale.formated_date,       // used in your UI
      sale.created_at,          // common backend field
      sale.createdAt            // JS-style
    ];
    for (const d of candidates) {
      const t = d ? new Date(d).getTime() : NaN;
      if (!Number.isNaN(t)) return t;
    }
    // fallback: try numeric id (if sequential)
    const idNum = Number(sale.sales_information_id ?? sale.sale_id ?? sale.id);
    return Number.isFinite(idNum) ? idNum : 0;
  };

  // --- build filtered + sorted dataset (latest first) ---
  const filteredData = useMemo(() => {
    let data = Array.isArray(saleHeader) ? saleHeader : [];

    // filter by type
    if (saleFilter === 'normal') {
      data = data.filter(sale => !sale.is_for_delivery);
    } else if (saleFilter === 'for_delivery') {
      // ✅ this option existed in the dropdown but wasn’t handled
      data = data.filter(sale => sale.is_for_delivery);
    } else if (saleFilter === 'delivered') {
      data = data.filter(sale => sale.is_for_delivery && sale.is_delivered && !sale.is_pending);
    } else if (saleFilter === 'undelivered') {
      data = data.filter(sale => sale.is_for_delivery && !sale.is_delivered && !sale.is_pending);
    } else if (saleFilter === 'out_for_delivery') {
      data = data.filter(sale => sale.is_for_delivery && !sale.is_delivered && sale.is_pending);
    }

    // search
    const q = (searchSale || '').toLowerCase();
    if (q) {
      data = data.filter(sale =>
        sale.charge_to?.toLowerCase().includes(q) ||
        sale.tin?.toLowerCase().includes(q) ||
        sale.address?.toLowerCase().includes(q)
      );
    }

    // sort: latest first
    return [...data].sort((a, b) => getSaleTime(b) - getSaleTime(a));
  }, [saleHeader, saleFilter, searchSale]);

  // pagination
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  return (
    <div className='pt-20 lg:pt-8 px-4 lg:px-8'>
      <ViewingSalesAndDelivery
        openModal={openItems}
        type={modalType}
        closeModal={closeViewingProducts}
        user={user}
        headerInformation={saleData}
        sale_id={saleData.sale_id}
        currencyFormat={currencyFormat}
      />

      <h1 className='text-[33px] leading-[36px] font-bold text-green-900'>
        SALES TRANSACTIONS
      </h1>
      <hr className="mt-3 mb-6 border-t-4 border-green-800 rounded-lg"/>

      {/* Controls */}
      <div className='lg:flex gap-4 lg:gap-9'>
        <div className='w-full lg:w-[400px] text-sm pb-4 lg:pb-0'>
          <input
            type="text"
            placeholder="Search"
            className="border outline outline-1 outline-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:py-2 transition-all px-3 py-2 rounded-lg w-full h-9"
            onChange={handleSaleSearch}
          />
        </div>

        <DropdownCustom
          value={saleFilter}
          onChange={e => setSaleFilter(e.target.value)}
          label="Sale Type"
          variant="floating"
          size="sm"
          options={[
            { value: 'all', label: 'All Sales' },
            { value: 'normal', label: 'Normal Sales' },
            { value: 'for_delivery', label: 'For Delivery Sales' },  // ✅ now works
            { value: 'delivered', label: 'Delivered Sales' },
            { value: 'undelivered', label: 'Undelivered Sales' },
            { value: 'out_for_delivery', label: 'Out for Delivery Sales' }
          ]}
        />

        {user && user.role && user.role.some(r => ['Sales Associate'].includes(r)) && (
          <div className="lg:pt-0 pt-3 ml-auto flex gap-4">
            <button
              className='flex items-center justify-center gap-x-3 bg-[#119200] text-sm text-white font-medium hover:bg-[#56be48] w-full lg:w-auto px-5 py-2 rounded-lg transition-all'
              onClick={() => setOpenSaleModal(true)}
            >
              <FaCashRegister /> ADD SALE
            </button>
          </div>
        )}
      </div>

      <hr className="border-t-2 my-4 w-full border-gray-500 rounded-lg"/>

      <div className="overflow-x-auto overflow-y-auto h-[55vh] border-b-2 border-gray-500 rounded-lg hide-scrollbar pb-6">
        <table className={`w-full ${currentPageData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200 text-sm`}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-24">SALE ID</th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">CHARGE TO</th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">TIN</th>
              <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">ADDRESS</th>
              <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-32">DATE</th>
              <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">AMOUNT NET VAT</th>
              <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-28">VAT</th>
              <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-28">TOTAL AMOUNT</th>
            </tr>
          </thead>

          <tbody className="bg-white relative">
            {salesLoading ? (
              <tr>
                <td colSpan={8}>
                  <ChartLoading message='Loading sales records...' />
                </td>
              </tr>
            ) : currentPageData.length === 0 ? (
              <NoInfoFound col={8}/>
            ) : (
              currentPageData.map((row, rowIndex) => (
                <tr
                  key={row.sales_information_id ?? rowIndex}
                  className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1) % 2 === 0 ? "bg-[#F6F6F6]" : ""}`}
                  onClick={() => { openSoldItems(row); setModalType("sales"); }}
                >
                  <td className="px-4 py-2 text-center">{row.sales_information_id}</td>
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{row.charge_to}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.tin}</td>
                  <td className="px-4 py-2">{row.address}</td>
                  <td className="px-4 py-2 text-right">{row.formated_date}</td>
                  <td className="px-4 py-2 text-right">{currencyFormat(row.amount_net_vat)}</td>
                  <td className="px-4 py-2 text-right">{currencyFormat(row.vat)}</td>
                  <td className="px-5 py-2 text-right">{currencyFormat(row.total_amount_due)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-3 pb-6 px-3'>
        {/* Mobile */}
        <div className='flex justify-between items-center gap-2 sm:hidden'>
          <div className='text-xs text-gray-600 flex-shrink-0'>
            {filteredData.length > 0 ? (
              <>Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length}</>
            ) : <span></span>}
          </div>
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
        </div>

        {/* Desktop */}
        <div className="hidden lg:relative lg:flex lg:items-center w-full">
          <div className="text-[13px] text-gray-600">
            {filteredData.length > 0 ? (
              <>Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} items</>
            ) : <span></span>}
          </div>
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
  );
}

export default Sales;
