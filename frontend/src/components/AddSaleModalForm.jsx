import React, { useState, useEffect } from 'react';
import { useAuth } from '../authentication/Authentication';
import { IoMdAdd } from "react-icons/io";
import  toTwoDecimals from '../utils/fixedDecimalPlaces.js';
import {currencyFormat} from '../utils/formatCurrency.js';
import ConfirmationDialog from './dialogs/ConfirmationDialog.jsx';
import FormLoading from './common/FormLoading';
import dayjs from 'dayjs';
import api from '../utils/api.js';


function AddSaleModalForm({openSaleModal, setOpenSaleModal, productsData, setSaleHeader, fetchProductsData}) {


  const {user} = useAuth();

  let productsToSell = productsData;

  //THIS PREVENTS USER WITH COMBINE ROLES OF MANAGER AND SALES ASSOCIATE TO SELL PRODUCTS FROM ALL BRANCHES
  if (user && user.role.some(role => ['Branch Manager'].includes(role))){
    
    productsToSell = productsData.filter(product => product.branch_id === user.branch_id);

  }


  const dateToday = dayjs().format("YYYY-MM-DD");
  const dateTodayReadable = dayjs().format("MMMM D, YYYY");


  //HEADER INFORMATION
  const [chargeTo, setChargeTo] = useState('');
  const [tin, setTin] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(dateToday);
  
  // NEW: Delivery indicator
  const [isForDelivery, setIsForDelivery] = useState(false);
  




  //FOR DIALOG
  const [openDialog, setDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('');

  // LOADING STATE
  const [loading, setLoading] = useState(false);


  useEffect(() =>{
    setDate(dateToday)
  },[openSaleModal]);



  //PRODUCT INPUT INFORMATION
  const [productSelected, setProductSelected] = useState([]);
  const [rows, setRows] = React.useState([
    { product_id: '', quantity: 0, unit: '', unitPrice: 0, amount: 0 }
  ]);




  //CALCULATING AMOUNT AND VAT
  const [additionalDiscount, setAdditionalDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
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
    setOpenSaleModal(false);

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
    setAdditionalDiscount(0);
    setDeliveryFee(0);
    setIsForDelivery(false);


  };

  
  //MULTIPLY THE AMOUNT BY THE PRODUCT'S UNIT PRICE
  const createAnAmount = (index) =>{

    const currentId = rows[index].product_id;
    
    const product = productsToSell.find(p => p.product_id === currentId);

    const availableQuantity = product ? Number(product.quantity) : 0;

    const currentQuantity = Number(rows[index].quantity) || 0;


    if (currentId && currentQuantity > availableQuantity){

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
    console.log(newRows);

    
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


  //CALCULATES THE VAT AND TOTAL AMOUNT
  const vatAmount =(amount) =>{
    const vatCalculated = amount * 0.12;
    setVat(vatCalculated);
    
    
    calculateTotalAmount(amount, vatCalculated, additionalDiscount, deliveryFee);
  };

  //CENTRALIZED TOTAL CALCULATION
  const calculateTotalAmount = (netAmount, vatAmount, discount, delivery) => {
    const total = (netAmount + vatAmount + delivery) - discount;
    setTotalAmountDue(Math.max(0, total)); 
  };

  //HANDLE DISCOUNT CHANGE
  const handleDiscountChange = (discountAmount) => {
    setAdditionalDiscount(discountAmount);
    calculateTotalAmount(amountNetVat, vat, discountAmount, deliveryFee);
  };

  //HANDLE DELIVERY FEE CHANGE
  const handleDeliveryFeeChange = (feeAmount) => {
    setDeliveryFee(feeAmount);
    calculateTotalAmount(amountNetVat, vat, additionalDiscount, feeAmount);
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
    return productsToSell.filter(product => {
      const isNotSelected = !Object.values(productSelected).includes(String(product.product_id)) || 
                           String(rows[index].product_id) === String(product.product_id);
      const matchesSearch = product.product_name.toLowerCase().includes(searchTerm.toLowerCase());
      return isNotSelected && matchesSearch;
    });
  };

  
  //SUBMIT THE DATA
  const submitSale = async () =>{
    try {
      setLoading(true);

      const headerInformationAndTotal = {
        chargeTo,
        tin,
        address,
        date,
        branch_id: user.branch_id,
        vat,
        amountNetVat,
        totalAmountDue,
        transactionBy: user.full_name,
        additionalDiscount,
        deliveryFee,
        isForDelivery
        

      };

      const saleData = {
        headerInformationAndTotal,
        productRow: rows
      };

      const data = await api.post(`/api/sale`, saleData);
      setSaleHeader((prevData) => [...prevData, data.data]);

      setEmptyQuantiy(false);
      setSomeEmpty(false);
      closeModal();

      //RE-FETCH WITH THE LATEST PRODUCT DATA(FRONTEND)
      fetchProductsData();
    } catch (error) {
      console.error('Error submitting sale:', error);
    } finally {
      setLoading(false);
    }
  };




  if (!user) return; // PREVENRTS RENDERING THE REST OF THE COMPONENT IF USER IS STILL EMPTY


  return (
     <div>
        {/* Loading overlay */}
        {loading && (
          <FormLoading message="Processing sale..." />
        )}

        {openDialog && 

          <ConfirmationDialog
            mode={dialogMode}
            message={"Are you sure you want to add the informaion to the sale?"}
            submitFunction={() => submitSale()}
            onClose={() => {setDialog(false); setDialogMode('')}}

          />
        
        }

        {openSaleModal && user.role.some(role => ['Sales Associate'].includes(role)) &&(
            <div
            className="fixed inset-0 bg-black/35 bg-opacity-50 z-100 backdrop-blur-[1px]"
            style={{ pointerEvents: 'auto' }}  onClick={closeModal}
            />
        )}

        <dialog className='bg-transparent fixed top-0 bottom-0  z-200 rounded-md animate-popup' open={openSaleModal && user && user.role.some(role => ['Sales Associate'].includes(role)) }>
            <div className="relative flex flex-col border border-gray-600/40 bg-white  w-[1000px] rounded-md py-7  px-3 animate-popup" >
            

                <div className='text-left ml-8'>
                    <h3 className="font-bold text-3xl py-4 ">
                      CHARGE SALES INVOICE
                    </h3>

                    <div className="col-span-4 flex gap-x-10 justify-left">
                        <div className="text-xs text-gray-500 font-semibold">
                            Branch: <span className="text-gray-700 text-md">{user.branch_name}</span>
                        </div>
                        <div className="text-xs text-gray-500 font-semibold mt-1 md:mt-0">
                            Branch Address: <span className="text-gray-700">{user.address}</span>
                        </div>
                    </div>
                </div>

                <div className="pb-4 pt-2 px-8 w-full flex-1 flex flex-col">
                    {/*FORMS */}
                    <form onSubmit={(e) => {e.preventDefault(); setDialog(true); setDialogMode('add')}} className='w-full flex-1 flex flex-col'>
                    
                        {/*EXIT BUTTON*/}
                        <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
                        onClick={closeModal}>✕</button>

                        
                        {/*CUSTOMER INFORMATION*/}

                        <div className='flex flex-col'>
                            
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
                                                          <div className='font-light text-xs'> Quantity: {product.quantity}</div>
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

                          {/* NEW: Additional Discount and Delivery Fee Fields */}
                          <div className='grid grid-cols-1 md:grid-cols-3 gap-3 my-2 p-3 rounded border'>
                            
                            {/* Delivery Checkbox */}
                            <div className='w-full flex items-center'>
                                <input 
                                  type="checkbox"
                                  id="isForDelivery"
                                  className='mr-2'
                                  checked={isForDelivery}
                                  onChange={(e) => setIsForDelivery(e.target.checked)}
                                />
                                <label htmlFor="isForDelivery" className='text-xs font-medium text-gray-700 uppercase tracking-wide cursor-pointer'>
                                  For Delivery
                                </label>
                            </div>
                            
                            <div className='w-full'>
                                <label className='block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide'>Delivery Fee</label>
                                <input 
                                  type="text"
                                  className='w-full border border-gray-300 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all' 
                                  value={deliveryFee}
                                  onKeyDown={(e) => {
                                    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={e => handleDeliveryFeeChange(Number(e.target.value) || 0)}
                                  placeholder="Enter delivery fee"
                                />
                            </div>

                            <div className='w-full'>
                                <label className='block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide'>Additional Discount</label>
                                <input 
                                  type="text"
                                  className='w-full border border-gray-300 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all' 
                                  value={additionalDiscount}
                                  onKeyDown={(e) => {
                                    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={e => handleDiscountChange(Number(e.target.value) || 0)}

                                  placeholder="Enter additional discount"
                                />
                            </div>

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
                                        
                                        {/* NEW: Additional Discount and Delivery Fee Summary */}
                                        {deliveryFee > 0 && (
                                          <div className='text-sm'>
                                            <span className='text-xs font-bold text-blue-600'>Delivery Fee:</span>
                                            <span className='ml-2 font-medium text-blue-600'>{currencyFormat(toTwoDecimals(deliveryFee))}</span>
                                          </div>
                                        )}
                                        {additionalDiscount > 0 && (
                                          <div className='text-sm'>
                                            <span className='text-xs font-bold text-red-600'>Additional Discount:</span>
                                            <span className='ml-2 font-medium text-red-600'>-{currencyFormat(toTwoDecimals(additionalDiscount))}</span>
                                          </div>
                                        )}
                                        
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
                                  disabled={!amountNetVat || !totalAmountDue  || !chargeTo || !tin || !address || someEmpy || emptyQuantity || exceedQuanity.length > 0}
                                  type='submit' 
                                  className={`py-3 px-8 font-medium rounded-sm transition-all  disabled:bg-green-200 disabled:text-green-600 disabled:cursor-not-allowed disabled:border disabled:border-green-200  bg-green-600 hover:bg-green-700 text-white border border-green-600 shadow-sm hover:shadow-md`}>
                                    Confirm Sale
                                </button>

                                {(!amountNetVat || !totalAmountDue  || !chargeTo || !tin || !address || someEmpy || emptyQuantity || exceedQuanity.length > 0) &&
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