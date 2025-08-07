import React from 'react';
import { useAuth } from '../authentication/Authentication';
import { IoMdAdd } from "react-icons/io";

function AddSaleModalForm({isModalOpen, onClose}) {

  const {user} = useAuth();
  const [rows, setRows] = React.useState([
    { product: '', quantity: '', unit: '', unitPrice: '', amount: '' }
  ]);


  const submitSale = () =>{
    console.log(rows);
  }

  return (
     <div>
        {isModalOpen && user.role === 'Sales Associate' &&(
            <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-100"
            style={{ pointerEvents: 'auto' }}  onClick={onClose}
            />
        )}

        <dialog className='bg-transparent fixed top-0 bottom-0  z-200 rounded-md animate-popup' open={isModalOpen && user.role === 'Sales Associate'}>
            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[675px] w-[1000px] rounded-md py-7  px-3 animate-popup" >

                <div>
                    <h3 className="font-bold text-3xl py-4 text-center">
                    ADD SALE
                    </h3>
                </div>

                <div className="pb-4 pt-2 px-8 w-full flex-1 flex flex-col">
                    {/*FORMS */}
                    <form method="dialog" onSubmit={submitSale} className='w-full flex-1 flex flex-col'>
                    
                        {/*EXIT BUTTON*/}
                        <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
                        onClick={onClose}>✕</button>

                        {/*SALES INFORMATION ID PLACEMENT*/}
                        <div className='w-full text-center mb-6'>
                            <h1 className='font-semibold text-lg'>Sales Information Id: 234455</h1>
                        </div>



                        {/*CUSTOMER INFORMATION*/}
                        <div className='flex gap-x-2 mb-6'>
                            
                            <div className='w-full'>
                                <h2 className='text-xs font-bold mb-2'>CHARGE TO</h2>
                                <input type="text" className='w-full border' />
                            </div>

                            <div className='w-full'>
                                <h2 className='text-xs font-bold mb-2'>TIN</h2>
                                <input type="text" className='w-full border' />
                            </div>

                            <div className='w-full'>
                                <h2 className='text-xs font-bold mb-2'>ADDRESS</h2>
                                <input type="text" className=' w-full border' />
                            </div>

                            <div className='w-full'>
                                <h2 className='text-xs font-bold mb-2'>DATE</h2>
                                <input type="text" className=' w-full border' />
                            </div>

                        </div>


                        {/*PRODUCT INFORMATION*/}
                        <div className='text-center'>
                            <button
                              type="button"
                              className="bg-green-600 py-2 px-4 text-white mb-6 rounded-sm"
                              onClick={() =>
                                setRows([...rows, { product: '', quantity: '', unit: '', unitPrice: '', amount: '' }])
                              }
                            >
                              <h1 className='text-xs font-medium flex items-center gap-x-2'><IoMdAdd />ADD NEW ROW</h1>
                            </button>

                            <div className="h-[250px] overflow-y-auto border border-gray-200">
                              <table className="w-full divide-y divide-gray-200 text-sm">
                                  <thead className="sticky top-0 bg-gray-100">
                                      <tr>
                                          <th className="px-4 py-2 text-center text-xs font-medium">
                                          PRODUCT 
                                          </th>

                                          <th className="px-4 py-2 text-center text-xs font-medium">
                                              QUANTITY
                                          </th>
                                          
                                          <th className="px-4 py-2 text-center text-xs font-medium">
                                              UNIT                              
                                          </th>

                                          <th className="px-4 py-2 text-center text-xs font-medium">
                                              UNIT PRICE
                                          </th>

                                          <th className="px-4 py-2 text-center text-xs font-medium">
                                              AMOUNT
                                          </th>

                                      </tr>
                                      

                                  </thead>

                                  <tbody>
                                      {rows.map((row, idx) => (
                                        <tr key={idx}>
                                          <td className="px-2 py-3">
                                            <input type="text" className="border w-full" value={row.product} onChange={e => {
                                              const newRows = [...rows];
                                              newRows[idx].product = e.target.value;
                                              setRows(newRows);
                                            }} />
                                          </td>
                                          <td className="px-2">
                                            <input type="text" className="border w-full" value={row.quantity} onChange={e => {
                                              const newRows = [...rows];
                                              newRows[idx].quantity = e.target.value;
                                              setRows(newRows);
                                            }} />
                                          </td>
                                          <td className="px-2">
                                            <input type="text" className="border w-full" value={row.unit} onChange={e => {
                                              const newRows = [...rows];
                                              newRows[idx].unit = e.target.value;
                                              setRows(newRows);
                                            }} />
                                          </td>
                                          <td className="px-2">
                                            <input type="text" className="border w-full" value={row.unitPrice} onChange={e => {
                                              const newRows = [...rows];
                                              newRows[idx].unitPrice = e.target.value;
                                              setRows(newRows);
                                            }} />
                                          </td>
                                          <td className="px-2">
                                            <input type="text" className="border w-full" value={row.amount} onChange={e => {
                                              const newRows = [...rows];
                                              newRows[idx].amount = e.target.value;
                                              setRows(newRows);
                                            }} />
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>

                              </table>
                            </div>

                        </div>

                        {/*TOTAL AND SUBMIT BUTTON*/}
                        <div className='mt-4 flex w-full flex-1'>

                            {/* TOTAL AMOUNT AND TAXES*/}
                            <div className='w-full  flex flex-col justify-between'>

                                {/*FOR VAT CALCULATIONS*/}
                                <div className='flex gap-x-20'>
                                    {/*REGULAR VAT*/}
                                    <div>
                                      VAT: 100
                                    </div>

                                    {/*AMOUNT NET VAT*/}
                                    <div>
                                      AMOUNT NET VAT: 1000
                                    </div>

                                </div>


                                {/*TOTAL AMOUNT*/}
                                <div>
                                  TOTAL AMOUNT DUE: 100000
                                </div>
                                
                            </div>

                            
                            {/*SUBMIT BUTTON*/}
                            <div className='w-[50%] flex items-center justify-center'>
                                <button type='submit' className='py-1 px-3 bg-green-700 text-white rounded-sm'>Confirm Sale</button>

                            </div>
                        </div>


                    </form>

                </div>

            </div>
                
        </dialog>

     </div>
  )
}

export default AddSaleModalForm