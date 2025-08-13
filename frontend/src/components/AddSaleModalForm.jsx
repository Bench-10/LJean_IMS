import React, { useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import { IoMdAdd } from "react-icons/io";
import dayjs from 'dayjs';

function AddSaleModalForm({isModalOpen, setIsModalOpen, productsData}) {

  const {user} = useAuth();


  const dateToday = dayjs().format("YYYY-MM-DD");
  const dateTodayReadable = dayjs().format("MMMM D, YYYY");


  //HEADER INFORMATION
  const [chargeTo, setChargeTo] = useState('');
  const [tin, setTin] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(dateToday);


  //PRODUCT INPUT INFORMATION
  const [productSelected, setProductSelected] = useState([]);
  const [rows, setRows] = React.useState([
    { product_id: '', quantity: 0, unit: '', unitPrice: 0, amount: 0 }
  ]);


  //CALCULATING AMOUNT AND VAT
  const [vat, setVat] = useState(0);
  const [amountNetVat, setAmount] = useState(0);
  const [totalAmountDue, setTotalAmountDue] = useState(0);


  //TO RESET THE FORM ONCE CLOSED
  const closeModal = () =>{
    setIsModalOpen(false);

    setRows([{product_id: '', quantity: 0, unit: '', unitPrice: 0, amount: 0}]);
    setProductSelected([]);
    setAmount(0);
    setTotalAmountDue(0);
    setChargeTo('');
    setTin('');
    setAddress('');
    setDate('');
    setVat(0);

  };


  const removeSpecificProduct = (index) =>{

  };

  
  //MULTIPLY THE AMOUNT BY THE PRODUCT'S UNIT PRICE
  const createAnAmount = (index) =>{
    const productAmount = rows[index].quantity * rows[index].unitPrice
    const newRows = [...rows];
    newRows[index].amount = productAmount;
    setRows(newRows);

    totalAmount(newRows);

  };


  //ADDS ALL THE AMOUNT OF ALL THE PRODUCTS PRESENT IN THE SALE
  const totalAmount=(newData)=>{

    const final = newData.reduce((sum, product) => {
      const value = Number(product.amount); 
      return sum + (isNaN(value) ? 0 : value); 
      
    }, 0);

    setAmount(final);
    vatAmount(final)

  };


  //CALCULATES THE VAT(MIGHT CHANGE IN THE FUTURE)
  const vatAmount =(amount) =>{
    const vat = amount * 0.12;
    setVat(vat);

    //SETS THE TOTAL AMOUNT + VAT
    setTotalAmountDue(amount + vat);
    
  };

  
  //SUBMIT THE DATA
  const submitSale = () =>{
    console.log(rows);

    


    closeModal();
  }

  return (
     <div>
        {isModalOpen && user.role === 'Sales Associate' &&(
            <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-100"
            style={{ pointerEvents: 'auto' }}  onClick={closeModal}
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
                        onClick={closeModal}>✕</button>


                        {/*CUSTOMER INFORMATION*/}
                        <div className='flex gap-x-2 my-6'>
                            
                            <div className='w-full'>
                                <h2 className='text-xs font-bold mb-2'>CHARGE TO</h2>
                                <input 
                                  type="text" 
                                  className='w-full border' 
                                  value={chargeTo}
                                  onChange={(e) => setChargeTo(e.target.value)}
                                
                                />

                            </div>

                            <div className='w-full'>
                                <h2 className='text-xs font-bold mb-2'>TIN</h2>
                                <input 
                                  type="text" 
                                  className='w-full border' 
                                  value={tin}
                                  onChange={(e) => setTin(e.target.value)}

                                />

                            </div>

                            <div className='w-full'>
                                <h2 className='text-xs font-bold mb-2'>ADDRESS</h2>
                                <input 
                                  type="text" 
                                  className='w-full border' 
                                  value={address}
                                  onChange={(e) => setAddress(e.target.value)}

                                />

                            </div>

                            <div className='w-full'>
                                <h2 className='text-xs font-bold mb-2'>DATE</h2>
                                <input 
                                  type="text" 
                                  className='w-full border' 
                                  value={dateTodayReadable}
                                  readOnly
                                  
                                />

                            </div>

                        </div>


                        {/*PRODUCT INFORMATION*/}
                        <div className='text-center'>
                            <button
                              type="button"
                              className="bg-green-600 py-2 px-4 text-white mb-6 rounded-sm"
                              onClick={() =>
                                setRows([...rows, { product_id: '', quantity: 0, unit: '', unitPrice: 0, amount: 0 }])
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

                                            <select
                                              className="border w-full"
                                              value={row.product_id}
                                              onChange={e => {
                                                const selectedProductId = e.target.value;
                                                const selectedProduct = productsData.find(
                                                  (product) => String(product.product_id) === selectedProductId
                                                );
                                                const newRows = [...rows];
                                                newRows[idx].product_id = selectedProductId;
                                                if (selectedProduct) {
                                                  newRows[idx].unitPrice = selectedProduct.unit_price || '';
                                                  newRows[idx].unit = selectedProduct.unit || '';
                                                }
                                                setRows(newRows);
                                                setProductSelected([...productSelected, selectedProductId]);
                                              }}
                                            >

                                              <option value="" onClick={removeSpecificProduct(idx)}>Select Product</option>
                                              {productsData.map((product) => {
                                                if (
                                                  productSelected.includes(String(product.product_id)) &&
                                                  String(row.product_id) !== String(product.product_id)
                                                ) {
                                                  return null;
                                                }
                                                return (
                                                  <option key={product.product_id} value={product.product_id}>
                                                    {product.product_name}
                                                  </option>
                                                );
                                              })}

                                            </select>

                                          </td>


                                          <td className="px-2">
                                            <input type="text" className="border w-full" value={row.quantity} onChange={e => {
                                              const newRows = [...rows];
                                              newRows[idx].quantity = e.target.value;
                                              setRows(newRows);
                                            }} onKeyUp={() => createAnAmount(idx)}
                                            onKeyDown={(e) => {
                                              if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                                                e.preventDefault();
                                              }
                                            }}
                                            />
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
                                            }} readOnly />
                                          </td>


                                          <td className="px-2">
                                            <input type="text" className="border w-full" value={row.amount} onChange={e => {
                                              const newRows = [...rows];
                                              newRows[idx].amount = e.target.value;
                                              setRows(newRows);
                                            }} onKeyUp={(e) => setAmount(e.target.value)} readOnly />
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
                                      VAT: {vat}
                                    </div>

                                    {/*AMOUNT NET VAT*/}
                                    <div>
                                      AMOUNT NET VAT: {amountNetVat}
                                    </div>

                                </div>


                                {/*TOTAL AMOUNT*/}
                                <div>
                                  TOTAL AMOUNT DUE:{totalAmountDue}
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