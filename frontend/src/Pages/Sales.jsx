import React, { useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import NoInfoFound from '../utils/NoInfoFound';
import axios from 'axios';

function Sales({setIsModalOpen, saleHeader, sanitizeInput}) {

  const {user} = useAuth();

  const [openItems, setOpenSoldItems] = useState(false);
  const [soldItems, setSoldItems] = useState([]);
  const [searchSale, setSearchSale] = useState('');


  //HEADER AND TOTAL INFORMATION
  const [saleData, setSaleData ] = useState({sale_id: '', chargeTo: '', tin: '', address: '', date: '', amountNet: '', vat: '', total: ''})


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
      total: sailInfo.total_amount_due

    });


    const soldItems = await axios.get(`http://localhost:3000/api/sale_items?sale_id=${sailInfo.sales_information_id}`);

    setSoldItems(soldItems.data);

    setOpenSoldItems(true);

  };

  const closeViewingProducts = () => {
    setOpenSoldItems(false);
    setSoldItems([]);
  
    setSaleData({
      sale_id: '', 
      chargeTo: '', 
      tin: '', 
      address: '', 
      date: '', 
      amountNet: '', 
      vat: '', 
      total: ''
    });


  };

  //SEARCH SALE INFORMATION
  const handleSaleSearch = (event) =>{
    setSearchSale(sanitizeInput(event.target.value))
  };

  let filteredSale = saleHeader;

  const filteredData = filteredSale.filter(sale => 
    sale.charge_to.toLowerCase().includes(searchSale.toLowerCase()) ||
    sale.tin.toLowerCase().includes(searchSale.toLowerCase()) ||
    sale.address.toLowerCase().includes(searchSale.toLowerCase()) 
    
  );

  return (
    <div className=' ml-[220px] px-8 py-2 max-h-screen'>

        {openItems &&(
          <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-40"
            style={{ pointerEvents: 'auto' }}  onClick={() => closeViewingProducts()}
          />
        )}

        <dialog className="bg-transparent fixed top-0 bottom-0  z-50" open={openItems}>
            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[750px] w-[1000px] rounded-md py-5 px-3 animate-popup" > 
                

              
                <button 
                    type='button' 
                    className="btn-sm btn-circle btn-ghost absolute right-2 top-2" 
                    onClick={() => closeViewingProducts() }
                >
                    ✕
                </button>

                <div className="pb-4 pt-2 px-8 w-full flex-1 flex flex-col">
                    
                    {/*SALE HEADERS SECTION */}
                    <div className="mb-4">
                        <h2 className="text-xl font-semibold mb-3 text-gray-700 border-b pb-2">
                            Sale Information
                        </h2>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600">SALE ID</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {saleData.sale_id}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">DATE</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {saleData.date}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600">CHARGE TO</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {saleData.chargeTo}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">TIN</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {saleData.tin}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">ADDRESS</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {saleData.address}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/*   SOLD ITMES SEVTION*/}
                    <div className="flex-1 flex flex-col min-h-0">
                        <h2 className="text-base font-semibold mb-2 text-gray-700 border-b pb-1">
                            Items Sold
                        </h2>
                        
                        <div className="flex-1 overflow-y-auto border border-gray-200 mb-2 rounded-lg shadow-sm">
                            <table className="w-full divide-y divide-gray-200 text-sm">
                                <thead className="sticky top-0 bg-gray-100 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                                            PRODUCT NAME
                                        </th>


                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                                            QUANTITY
                                        </th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                                            UNIT
                                        </th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                                            UNIT PRICE
                                        </th>

                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                                            AMOUNT
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">

                                  {(!soldItems || soldItems.length === 0) ?
                                     (
                                        <NoInfoFound col={5}/>
                                     ) : 

                                     (


                                      soldItems.map((items, itemIndex) => (
                                        <tr key={itemIndex} className="hover:bg-gray-50 text-sm">
                                            <td className="px-3 py-2 text-left">{items.product_name}</td>
                                            <td className="px-3 py-2 text-center">{items.quantity}</td>
                                            <td className="px-3 py-2 text-center">{items.unit}</td>
                                            <td className="px-3 py-2 text-right">₱ {items.unit_price}</td>
                                            <td className="px-3 py-2 text-right">₱ {items.amount}</td>
                                        </tr>
                                      ))
                                      

                                     )
                                  }
                                    
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AMOUNTS SECTION*/}
                    <div className="border-t pt-4">
                        <div className="flex flex-row justify-between items-start">
                
                            <div className="flex-1 pr-8">
                                <h3 className="text-lg font-semibold text-gray-700 mb-3">Summary Details</h3>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <p className="text-sm text-gray-600 mb-2">
                                        This transaction was completed successfully. The total amount includes VAT and all applicable taxes.
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Please keep this record for your reference.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="w-[400px] bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="space-y-3">
                                    <div className="flex justify-between py-2 border-b border-gray-200 text-base">
                                        <span className="font-medium text-gray-600">Amount Net VAT:</span>
                                        <span className="font-semibold">₱ {saleData.amountNet}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-200 text-base">
                                        <span className="font-medium text-gray-600">VAT (10%):</span>
                                        <span className="font-semibold">₱ {saleData.vat}</span>
                                    </div>
                                    <div className="flex justify-between py-3 text-xl font-bold border-t-2 border-gray-400 mt-2">
                                        <span>TOTAL AMOUNT DUE:</span>
                                        <span className="text-green-700">₱ {saleData.total}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </dialog>


        <h1 className=' text-4xl font-bold text-green-900'>
          SALES TRANSACTIONS
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>


        {/*SEARCH AND ADD*/}
        <div className='flex w-full'>
          {/*SEARCH */}
          <div className='w-[400px]'>
            
            <input
              type="text"
              placeholder="Search"
              className="border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9"
              onChange={handleSaleSearch}
            />

          </div>


          {/*APEAR ONLY IF THE USER ROLE IS SALES ASSOCIATE */}
          {user.role === 'Sales Associate' &&
          
            <div  className="ml-auto flex gap-4">


              {/*ADD SALE BTN*/}
              <button className='border border-[#63FF4F] text-[#63FF4F] font-medium hover:bg-[#63FF4F] hover:text-white px-5 rounded-md transition-all'  onClick={() => setIsModalOpen(true)}> ADD SALE</button>

            </div>

          }
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>

        <div className="overflow-x-auto  overflow-y-auto h-[560px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className="w-full divide-y divide-gray-200  text-sm">
            <thead className="sticky top-0 bg-gray-100">
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
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-28">
                    ACTION
                  </th>

              </tr>
            </thead>

            
            <tbody className="bg-white">

              {filteredData.length === 0 ? 
                (
                  <NoInfoFound col={9}/>
                ) : 

                (
                  filteredData.map((row, rowIndex) => (
                
                    <tr key={rowIndex} className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}`} onClick={() => openSoldItems(row)}>
                      <td className="px-4 py-2 text-center"  >{row.sales_information_id}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.charge_to}</td>
                      <td className="px-4 py-2 whitespace-nowrap"  >{row.tin}</td>
                      <td className="px-4 py-2"  >{row.address}</td>
                      <td className="px-4 py-2 text-right"  >{row.formated_date}</td>
                      <td className="px-4 py-2 text-right"  >₱ {row.amount_net_vat}</td>
                      <td className="px-4 py-2 text-right"  >₱ {row.vat}</td>
                      <td className="px-4 py-2 text-right"  >₱ {row.total_amount_due}</td>
                      <td className="px-4 py-2 text-center">
                        <button className="bg-blue-600 hover:bg-blue-700 px-5 py-1 rounded-md text-white" >
                            View
                        </button>
                      </td>

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