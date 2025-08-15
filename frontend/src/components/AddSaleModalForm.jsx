import React, { useState, useEffect } from 'react';
import { useAuth } from '../authentication/Authentication';
import { IoMdAdd } from "react-icons/io";
import  toTwoDecimals from '../utils/fixedDecimalPlaces.js';
import dayjs from 'dayjs';
import axios from 'axios';

function AddSaleModalForm({isModalOpen, setIsModalOpen, productsData, setSaleHeader}) {


  const {user} = useAuth();


  const dateToday = dayjs().format("YYYY-MM-DD");
  const dateTodayReadable = dayjs().format("MMMM D, YYYY");


  //HEADER INFORMATION
  const [chargeTo, setChargeTo] = useState('');
  const [tin, setTin] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(dateToday);


  useEffect(() =>{
    setDate(dateToday)
  },[isModalOpen]);


  //PRODUCT INPUT INFORMATION
  const [productSelected, setProductSelected] = useState([]);
  const [rows, setRows] = React.useState([
    { product_id: '', quantity: 0, unit: '', unitPrice: 0, amount: 0 }
  ]);


  //CALCULATING AMOUNT AND VAT
  const [vat, setVat] = useState(0);
  const [amountNetVat, setAmount] = useState(0);
  const [totalAmountDue, setTotalAmountDue] = useState(0);
  

  //FOR SEARCHABLE DROPDOWN
  const [searchTerms, setSearchTerms] = useState({});
  const [showDropdowns, setShowDropdowns] = useState({});


  //SEARCH TERM ERROR HANDLING
  const [someEmpy, setSomeEmpty] = useState(false);


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
    setProductSelected([]);
    setSearchTerms({});
    setShowDropdowns({});

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
  const totalAmount = (newData)=>{

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



  //REMOVES THE SPECIFIC ROW
  const removeSaleRow = (index) =>{

    const newRows = rows.filter((_, i) => i !== index);
    
    
    const newProductSelected = {};
    Object.keys(productSelected).forEach(key => {
      const keyIndex = parseInt(key);
      if (keyIndex < index) {
      
        newProductSelected[keyIndex] = productSelected[keyIndex];
      } else if (keyIndex > index) {
       
        newProductSelected[keyIndex - 1] = productSelected[keyIndex];
      }
      
    });

    
    const newSearchTerms = {};
    Object.keys(searchTerms).forEach(key => {
      const keyIndex = parseInt(key);
      if (keyIndex < index) {
       
        newSearchTerms[keyIndex] = searchTerms[keyIndex];
      } else if (keyIndex > index) {
       
        newSearchTerms[keyIndex - 1] = searchTerms[keyIndex];
      }
      
    });


    setProductSelected(newProductSelected);
    setSearchTerms(newSearchTerms);
    setRows(newRows);
    totalAmount(newRows);

  };


  //HANDLES SEARCH INPUT FOR DROPDOWN
  const handleSearchChange = (index, value) => {
    setSearchTerms(prev => ({
      ...prev,
      [index]: value
    }));
    setShowDropdowns(prev => ({
      ...prev,
      [index]: true
    }));


  };


  const handleEmptysearchterm = () =>{

    const anyEmpty = Object.values(searchTerms).some(val => !val || val.trim() === "");
    setSomeEmpty(anyEmpty);

  };

  useEffect(() =>{
    handleEmptysearchterm();

  }, [searchTerms]);


  //HANDLES PRODUCT SELECTION FROM DROPDOWN
  const selectProduct = (index, product) => {
    const newRows = [...rows];
    newRows[index].product_id = product.product_id;
    newRows[index].unitPrice = product.unit_price || '';
    newRows[index].unit = product.unit || '';
    setRows(newRows);

    createAnAmount(index);
    
    setProductSelected(prev => ({
      ...prev,
      [index]: String(product.product_id)
    }));

    setSearchTerms(prev => ({
      ...prev,
      [index]: product.product_name
    }));

    setShowDropdowns(prev => ({
      ...prev,
      [index]: false
    }));
  };


  //FILTERS PRODUCTS BASED ON SEARCH TERM
  const getFilteredProducts = (index) => {
    const searchTerm = searchTerms[index] || '';
    return productsData.filter(product => {
      const isNotSelected = !Object.values(productSelected).includes(String(product.product_id)) || 
                           String(rows[index].product_id) === String(product.product_id);
      const matchesSearch = product.product_name.toLowerCase().includes(searchTerm.toLowerCase());
      return isNotSelected && matchesSearch;
    });
  };



  
  //SUBMIT THE DATA
  const submitSale = async () =>{
    console.log(rows);

    const headerInformationAndTotal = {
      chargeTo,
      tin,
      address,
      date,
      branch_id: user.branch_id,
      vat,
      amountNetVat,
      totalAmountDue,
    };

    const saleData = {
      headerInformationAndTotal,
      rows
    };

    console.log(headerInformationAndTotal);
    console.log(saleData);


    const data = await axios.post('http://localhost:3000/api/sale', saleData);
    setSaleHeader((prevData) => [...prevData, data.data]);

    closeModal();
  };

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

                                          <th className="px-4 py-2 text-center text-xs font-medium">
                                              ACTION
                                          </th>

                                      </tr>

                                  </thead>

                                  <tbody>
                                      {rows.map((row, idx) => (
                                        <tr key={idx}>
                                          <td className="px-2 py-3">

                                            <div className='relative'>
                                                <input 
                                                  type="text" 
                                                  className="border w-full "
                                                  placeholder="Search products..."
                                                  value={searchTerms[idx] || ''}
                                                  onChange={(e) => handleSearchChange(idx, e.target.value)}
                                                  onFocus={() => setShowDropdowns(prev => ({...prev, [idx]: true}))}
                                                  onBlur={() => {
                                                    
                                                    setTimeout(() => {
                                                      setShowDropdowns(prev => ({...prev, [idx]: false}));
                                                    }, 150);
                                                  }}
                                                />

                                                {showDropdowns[idx] && (
                                                  <div className='absolute top-[100%] z-[200] bg-white w-[100%] border border-gray-300 max-h-40 overflow-y-auto shadow-lg'>
                                                    {getFilteredProducts(idx).length > 0 ? (
                                                      getFilteredProducts(idx).map((product) => (
                                                        <div 
                                                          key={product.product_id}
                                                          className='p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100'
                                                          onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            selectProduct(idx, product);
                                                          }}
                                                        >
                                                          <div className='font-medium text-sm'>{product.product_name}</div>
                                                        </div>
                                                      ))
                                                    ) : (
                                                      <div className='p-2 text-gray-500 text-sm'>No products found</div>
                                                    )}
                                                  </div>
                                                )}
                                            </div>

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


                                          <td>
                                            <button type='button' onClick={() => {removeSaleRow(idx)}}>Remove</button>

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
                                      VAT: {toTwoDecimals(vat)}
                                    </div>

                                    {/*AMOUNT NET VAT*/}
                                    <div>
                                      AMOUNT NET VAT: {toTwoDecimals(amountNetVat)}
                                    </div>

                                </div>


                                {/*TOTAL AMOUNT*/}
                                <div>
                                  TOTAL AMOUNT DUE:{toTwoDecimals(totalAmountDue)}
                                </div>
                                
                            </div>

                            
                            {/*SUBMIT BUTTON*/}
                            <div className='w-[50%] flex flex-col items-center justify-center'>
                                <button 
                                  disabled={!totalAmountDue  || !chargeTo || !tin || !address || someEmpy}
                                  type='submit' 
                                  className={`py-1 px-3 bg-green-700 text-white rounded-sm ${(!totalAmountDue  || !chargeTo || !tin || !address || someEmpy) ? 'bg-green-300 cursor-not-allowed': ''} transition-all`}>
                                    Confirm Sale
                                </button>

                                {(!totalAmountDue  || !chargeTo || !tin || !address || someEmpy) &&
                                  <p className='font-thin italic text-xs'>*Please complete the required fields</p>
                                }

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