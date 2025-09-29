import React, { useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import NoInfoFound from '../components/common/NoInfoFound.jsx';
import ChartLoading from '../components/common/ChartLoading.jsx';
import {currencyFormat} from '../utils/formatCurrency.js';
import ViewingSalesAndDelivery from '../components/ViewingSalesAndDelivery.jsx';
import { FaCashRegister } from "react-icons/fa6";


function Sales({setOpenSaleModal, saleHeader, sanitizeInput, salesLoading}) {

  const {user} = useAuth();

  //THIS IS TO OPEN THE DETAILED INFORMATION FOR SALES
  const [openItems, setOpenSoldItems] = useState(false);
  const [modalType, setModalType] = useState("");


  const [searchSale, setSearchSale] = useState('');
  const [saleFilter, setSaleFilter] = useState('all');


  //HEADER AND TOTAL INFORMATION
  const [saleData, setSaleData ] = useState({sale_id: '', chargeTo: '', tin: '', address: '', date: '', amountNet: '', vat: '', total: '', discount: 0, transactionBy: '', deliveryFee: 0})


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
      deliveryFee: sailInfo.delivery_fee

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
      deliveryFee: 0
    });


  };

  //SEARCH SALE INFORMATION
  const handleSaleSearch = (event) =>{
    setSearchSale(sanitizeInput(event.target.value))
  };

  //FILTER DROPDOWN SELECTION
  let filteredSale = saleHeader;
  if (saleFilter === 'normal') {
    filteredSale = filteredSale.filter(sale => !sale.is_for_delivery);

  } else if (saleFilter === 'for_delivery') {
    filteredSale = filteredSale.filter(sale => sale.is_for_delivery);

  } else if (saleFilter === 'delivered') {
    filteredSale = filteredSale.filter(sale => sale.is_for_delivery && sale.is_delivered && !sale.is_pending);

  } else if (saleFilter === 'undelivered') {
    filteredSale = filteredSale.filter(sale => sale.is_for_delivery && !sale.is_delivered && !sale.is_pending);

  } else if (saleFilter === 'out_for_delivery') {
    filteredSale = filteredSale.filter(sale => sale.is_for_delivery && !sale.is_delivered && sale.is_pending);

  }

  // Filter by search
  const filteredData = filteredSale.filter(sale => 
    sale.charge_to?.toLowerCase().includes(searchSale.toLowerCase()) ||
    sale.tin?.toLowerCase().includes(searchSale.toLowerCase()) ||
    sale.address?.toLowerCase().includes(searchSale.toLowerCase()) 
  );

  return (
    <div className=' ml-[220px] px-8 py-2 max-h-screen'>

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

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>


        {/*SEARCH AND ADD*/}
        <div className='flex w-full items-center'>
          {/*SEARCH */}
          <div className='w-[400px]'>
            <input
              type="text"
              placeholder="Search"
              className="border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9"
              onChange={handleSaleSearch}
            />
          </div>

          {/* DROPDOWN FILTER */}
          <div className='ml-4'>
            <select
              value={saleFilter}
              onChange={e => setSaleFilter(e.target.value)}
              className="border outline outline-1 outline-gray-400 focus:outline-green-700 px-3 py-2 rounded h-9"
            >
              <option value="all">All Sales</option>
              <option value="normal">Normal Sales</option>
              <option value="for_delivery">For Delivery Sales</option>
              <option value="delivered">Delivered Sales</option>
              <option value="undelivered">Undelivered Sales</option>
              <option value="out_for_delivery">Out for Delivery Sales</option>
            </select>
          </div>

          {/*APPEAR ONLY IF THE USER ROLE IS SALES ASSOCIATE */}
          {user.role.some(role => ['Sales Associate'].includes(role)) &&
            <div className="ml-auto flex gap-4 h-9">
              {/*ADD SALE BTN*/}
              <button className='flex items-center gap-x-3 bg-[#119200] text-white font-medium hover:bg-[#63FF4F] px-5 rounded-md transition-all'  onClick={() => setOpenSaleModal(true)}> 
                <FaCashRegister /> ADD SALE
              </button>
            </div>
          }
        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>

        <div className="overflow-x-auto  overflow-y-auto h-[560px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className={`w-full ${filteredData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200  text-sm`}>
            <thead className="sticky top-0 bg-gray-100 z-10">
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
              
                filteredData.length === 0 ? 
                  (
                    <NoInfoFound col={9}/>
                  ) : 

                  (
                    filteredData.map((row, rowIndex) => (
                  
                      <tr key={rowIndex} className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}`} onClick={() => {openSoldItems(row); setModalType("sales")}}>
                        <td className="px-4 py-2 text-center"  >{row.sales_information_id}</td>
                        <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.charge_to}</td>
                        <td className="px-4 py-2 whitespace-nowrap"  >{row.tin}</td>
                        <td className="px-4 py-2"  >{row.address}</td>
                        <td className="px-4 py-2 text-right"  >{row.formated_date}</td>
                        <td className="px-4 py-2 text-right"  >{currencyFormat(row.amount_net_vat)}</td>
                        <td className="px-4 py-2 text-right"  >{currencyFormat(row.vat)}</td>
                        <td className="px-5 py-2 text-right"  >{currencyFormat(row.total_amount_due)}</td>

                      </tr>
                    ))
                  ) 
              }
              
            </tbody>
          </table>
        </div>


        
    </div>
  )
}

export default Sales