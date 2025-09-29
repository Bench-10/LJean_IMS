import React, { useEffect, useState } from 'react';
import NoInfoFound from './common/NoInfoFound';
import api from '../utils/api';
import { currencyFormat } from '../utils/formatCurrency';
import { BsTelephoneFill } from "react-icons/bs";
import { RiCellphoneFill } from "react-icons/ri";
import { MdEmail, MdOutlineCorporateFare } from "react-icons/md";
import ChartLoading from './common/ChartLoading';

function ViewingSalesAndDelivery({openModal, closeModal, user, type, headerInformation, sale_id}) {

    const [soldItems, setSoldItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() =>{
        if (!sale_id) return;
        
        items();
    },[openModal])

    const items = async () =>{
        try {
            setLoading(true);

            const soldItems = await api.get(`/api/sale_items?sale_id=${sale_id}`);
            setSoldItems(soldItems.data);
            
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);

        }
        
    }
    
  if (!user) return;


  return (
    <div>
        {openModal &&(
          <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-40 backdrop-blur-[1px]"
            style={{ pointerEvents: 'auto' }}  onClick={closeModal}
          />
        )}

        <dialog className="bg-transparent fixed top-0 bottom-0  z-50" open={openModal}>
            <div className={`relative flex flex-col border border-gray-600/40 bg-white w-[1000px] rounded-md py-5 px-3 animate-popup`}> 
                

              
                <button 
                    type='button' 
                    className="btn-sm btn-circle btn-ghost absolute right-2 top-2" 
                    onClick={closeModal}
                >
                    ✕
                </button>

                <div className="pb-4 pt-2 px-8 w-full flex-1 flex flex-col">
                    
                    {/*SALE HEADERS SECTION */}
                    <div className="mb-4">

                        {/*HEADER INFORMATION */}
                        <div>
                            {/*TITLES */}
                            <div className='flex flex-col text-center gap-y-4'>
                                <div className='text-4xl font-bold text-green-900'>
                                    {user.branch_name.toUpperCase()}
                                </div>

                                <div className='text-xl font-semibold'>
                                    {user.address}
                                </div>

                                <div className='flex justify-center gap-x-5 text-xs'>

                                    <div className='flex items-center gap-x-2'>
                                        <BsTelephoneFill />
                                        {user.telephone_num}
                                    </div>

                                    <div className='flex items-center gap-x-2'>
                                        <RiCellphoneFill />
                                        {user.cellphone_num}
                                    </div>

                                    <div className='flex items-center gap-x-2'>
                                        <MdEmail />
                                        {user.branch_email}
                                    </div>

                                    <div className='flex items-center gap-x-2'>
                                        <MdOutlineCorporateFare />
                                        VAT Reg. TIN 186-705-637-000
                                    </div>
                                </div>
                            </div>
                            <h2 className="text-md font-bold mt-5 mb-3 text-gray-700 border-b pb-2 ">
                                {type === "sales" ? "CHARGE SALES INVOICE" : "DELIVERY DETAILS"}
                            </h2>
                        </div>
                        
                        <p className='text-xs mb-3'>
                            Person In-charge: <span className='font-bold italic'>{headerInformation.transactionBy}</span>
                        </p>
                        <div className={`grid grid-cols-2 gap-3 mb-3`}>
                            
                            <div>
                                <label className="text-xs font-bold text-gray-600">SALE ID</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {headerInformation.sale_id}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">DATE</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {headerInformation.date}
                                </div>
                            </div>
                             
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600">{type === "sales" ? "CHARGE TO" : "DELIVERY ID"}</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {type === "sales" ? headerInformation.chargeTo : headerInformation.delivery_id}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">{type === "sales" ? "TIN" : "COURIER NAME"}</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {type === "sales" ? headerInformation.tin : headerInformation.courier_name }
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">ADDRESS</label>
                                <div className="p-2 bg-gray-50 border rounded text-sm">
                                    {headerInformation.address}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/*   SOLD ITMES SEVTION*/}
                    <div className="flex-1 flex flex-col min-h-0">
                        <h2 className="text-base font-semibold mb-2 text-gray-700 border-b pb-1">
                            {type === "sales" ? "Items Sold" : "Products To Deliver" }
                        </h2>
                        
                        <div className="h-50 overflow-auto border border-gray-200 mb-2 rounded-lg shadow-sm">
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

                                        {type && type === "sales" && 
    
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                                                UNIT PRICE
                                            </th>
                                      
                                        }


                                        {type && type === "sales" && 
    
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50">
                                                 AMOUNT
                                            </th>
                                      
                                        }


                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">

                                    { loading ? (
                                           
                                            <ChartLoading message="Loading sales information..." />
                                               
                                        ) : 

                                        (!soldItems || soldItems.length === 0) ?
                                            (
                                                <NoInfoFound col={5}/>
                                            ) : 

                                            (


                                            soldItems.map((items, itemIndex) => (
                                                <tr key={itemIndex} className="hover:bg-gray-50 text-sm">
                                                    <td className="px-3 py-2 text-left">{items.product_name}</td>
                                                    <td className="px-3 py-2 text-center">{items.quantity.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-center">{items.unit}</td>

                                                    {type && type === "sales" && 
                                                        <td className="px-3 py-2 text-right">
                                                            {currencyFormat(items.unit_price)}
                                                        </td>
                                                    }

                                                    {type && type === "sales" && 
                                                        <td className="px-3 py-2 text-right">
                                                            {currencyFormat(items.amount)}
                                                        </td>
                                                    }

                                                </tr>
                                                
                                            ))
                                        
                                        )

                                    }
                                    
                                </tbody>

                            </table>

                        </div>

                    </div>
                    

                    
                    {/* AMOUNTS SECTION (ONLY APPEARS IF OPENED IN THE SALES PAGE)*/}

                    {type && type === "sales" &&
                        <div className="border-t pt-4">
                            <div className="flex flex-row justify-between items-start">
                    
                                <div className="flex-1 pr-8">
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Summary Details</h3>
                                    
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
                                            <span className="font-semibold">{currencyFormat(headerInformation.amountNet)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-200 text-base">
                                            <span className="font-medium text-gray-600">VAT (10%):</span>
                                            <span className="font-semibold">{currencyFormat(headerInformation.vat)}</span>
                                        </div>
                                        {(headerInformation.discount !== undefined && headerInformation.discount > 0 && type === "sales") && (
                                            <div className="flex justify-between py-2 border-b border-gray-200 text-base">
                                                <span className="font-medium text-amber-600">Discount:</span>
                                                <span className="font-semibold text-amber-600">-{currencyFormat(Number(headerInformation.discount))}</span>
                                            </div>
                                        )}
                                       
                                        {headerInformation.deliveryFee !== undefined && headerInformation.deliveryFee > 0 && type === "sales" && (
                                            <div className="flex justify-between py-2 border-b border-gray-200 text-base">
                                                <span className="font-medium text-blue-600">Delivery Fee:</span>
                                                <span className="font-semibold text-blue-600">{currencyFormat(Number(headerInformation.deliveryFee))}</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-between py-3 text-xl font-bold border-t-2 border-gray-400 mt-2">
                                            <span>TOTAL AMOUNT DUE:</span>
                                            <span className="text-green-700">{currencyFormat(headerInformation.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }

                </div>
            </div>
        </dialog>
        
    </div>
  )
}

export default ViewingSalesAndDelivery