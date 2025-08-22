import React, { useState, useEffect } from 'react';
import { useAuth } from '../authentication/Authentication';
import { IoMdAdd } from "react-icons/io";
import  toTwoDecimals from '../utils/fixedDecimalPlaces.js';
import {currencyFormat} from '../utils/formatCurrency.js';
import dayjs from 'dayjs';
import axios from 'axios';


function AddSaleModalForm({isModalOpen, setIsModalOpen, productsData, setSaleHeader, fetchProductsData}) {


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
  const [emptyQuantity, setEmptyQuantiy] = useState(false);


  //QUANTITY VALIDATION
  const [exceedQuanity, setExceedQuanity] = useState([]);

  

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
    setEmptyQuantiy(false);
    setSomeEmpty(false);
    setExceedQuanity([]);

  };

  
  //MULTIPLY THE AMOUNT BY THE PRODUCT'S UNIT PRICE
  const createAnAmount = (index) =>{

    const currentId = rows[index].product_id;
    
    const product = productsData.find(p => p.product_id === currentId);

    const availableQuantity = product ? product.quantity : 0;

    const currentQuantity = rows[index].quantity;


    if (currentId && currentQuantity > availableQuantity){
      console.log('Exceed');

      setExceedQuanity([...exceedQuanity, currentId]);

      return;
                                  


    } else if(exceedQuanity.includes(currentId) && currentQuantity <= availableQuantity){
      const updatedQuantityExceedingList = exceedQuanity.filter(q => q !== currentId)

      setExceedQuanity(updatedQuantityExceedingList);
    } 

   
    const productAmount = rows[index].quantity * rows[index].unitPrice
    const newRows = [...rows];
    newRows[index].amount = productAmount;

    preventEmptyQuantity(newRows);
    setRows(newRows);

    
    totalAmount(newRows);

  };


  //DISABLE BUTTON IF THERE ARE QUANTITY FEILDS THAT ARE CURRENTLY EMPTY
  const preventEmptyQuantity = (updatedRows) =>{

    if(!updatedRows){
      setEmptyQuantiy(false);

      return
    };

    const emptyQuantity = updatedRows.some(row => !row.product_id || row.product_id === ''  || !row.quantity || Number(row.quantity) === 0)

    setEmptyQuantiy(emptyQuantity);
  
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
      productRow: rows
    };

  


    const data = await axios.post('http://localhost:3000/api/sale', saleData);
    setSaleHeader((prevData) => [...prevData, data.data]);

    setEmptyQuantiy(false);
    setSomeEmpty(false);
    closeModal();

    //RE-FETCH WITH THE LATEST PRODUCT DATA(FRONTEND)
    fetchProductsData();

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
            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[760px] w-[1000px] rounded-md py-7  px-3 animate-popup" >

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
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6 p-4 bg-gray-50 rounded-lg border border-gray-200'>
                            
                            <div className='w-full'>
                                <label className='block text-xs font-semibold mb-2 text-gray-700 uppercase tracking-wide'>Charge To</label>
                                <input 
                                  type="text" 
                                  className='w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all' 
                                  
                                  value={chargeTo}
                                  onChange={(e) => setChargeTo(e.target.value)}
                                />
                            </div>

                            <div className='w-full'>
                                <label className='block text-xs font-semibold mb-2 text-gray-700 uppercase tracking-wide'>TIN</label>
                                <input 
                                  type="text" 
                                  className='w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all'
                                  
                                  value={tin}
                                  onChange={(e) => setTin(e.target.value)}
                                />
                            </div>

                            <div className='w-full'>
                                <label className='block text-xs font-semibold mb-2 text-gray-700 uppercase tracking-wide'>Address</label>
                                <input 
                                  type="text" 
                                  className='w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all'
                                  
                                  value={address}
                                  onChange={(e) => setAddress(e.target.value)}
                                />
                            </div>

                            <div className='w-full'>
                                <label className='block text-xs font-semibold mb-2 text-gray-700 uppercase tracking-wide'>Date</label>
                                <input 
                                  type="text" 
                                  className='w-full border border-gray-300 rounded-sm px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed'
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
                                {setRows(prevRows => {
                                  const updatedRows = [...prevRows, { product_id: '', quantity: 0, unit: '', unitPrice: 0, amount: 0 }];
                                  
                                  preventEmptyQuantity(updatedRows);
                                  return updatedRows;
                                });}
                              }
                            >
                              <h1 className='text-xs font-medium flex items-center gap-x-2'><IoMdAdd />ADD NEW ROW</h1>
                            </button>

                            <div className="h-[200px] overflow-y-auto border border-gray-200">
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


                                          <td className="px-2 relative">
                                            <div className="relative">
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
                                              {exceedQuanity.includes(row.product_id) && (
                                                <div
                                                  className="absolute left-0 w-full text-xs text-red-600 mt-1 z-10 bg-white pointer-events-none"
                                                  style={{ bottom: '-1.5em' }}
                                                >
                                                  *Not enough stock available
                                                </div>
                                              )}
                                            </div>
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
                                            <button type='button' onClick={() => {removeSaleRow(idx); preventEmptyQuantity()}}>Remove</button>

                                          </td>

                                        </tr>
                                      ))}

                                  </tbody>

                              </table>
                            </div>

                        </div>

                        {/*TOTAL AND SUBMIT BUTTON*/}
                        <div className='mt-6'>
                            {/* TOTAL CALCULATIONS SECTION*/}
                            <div className='border border-gray-200 rounded-sm p-4 mb-4 bg-gray-50'>
                                <div className='flex justify-between items-center mb-3'>
                                    <div className='flex gap-x-12'>
                                        <div className='text-sm'>
                                            <span className='text-xs font-bold text-gray-600'>VAT:</span>
                                            <span className='ml-2 font-medium'>{currencyFormat(toTwoDecimals(vat))}</span>
                                        </div>
                                        <div className='text-sm'>
                                            <span className='text-xs font-bold text-gray-600'>AMOUNT NET VAT:</span>
                                            <span className='ml-2 font-medium'>{currencyFormat(toTwoDecimals(amountNetVat))}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className='border-t border-gray-300 pt-3'>
                                    <div className='text-lg font-bold text-right'>
                                        <span className='text-gray-700'>TOTAL AMOUNT DUE: </span>
                                        <span className='text-green-700'>{currencyFormat(toTwoDecimals(totalAmountDue))}</span>
                                    </div>
                                </div>
                            </div>

                            {/*SUBMIT BUTTON*/}
                            <div className='text-center'>
                                <button 
                                  disabled={!totalAmountDue  || !chargeTo || !tin || !address || someEmpy || emptyQuantity || exceedQuanity.length > 0}
                                  type='submit' 
                                  className={`py-3 px-8 font-medium rounded-sm transition-all ${(!totalAmountDue  || !chargeTo || !tin || !address || someEmpy || emptyQuantity || exceedQuanity.length > 0) ? 'bg-green-200 text-green-600 cursor-not-allowed border border-green-200': 'bg-green-600 hover:bg-green-700 text-white border border-green-600 shadow-sm hover:shadow-md'}`}>
                                    Confirm Sale
                                </button>

                                {(!totalAmountDue  || !chargeTo || !tin || !address || someEmpy || emptyQuantity || exceedQuanity.length > 0) &&
                                  <p className='font-thin italic text-xs text-red-500 mt-3'>*Please complete the required fields</p>
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