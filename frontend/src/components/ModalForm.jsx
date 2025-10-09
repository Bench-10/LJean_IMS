import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../authentication/Authentication';
import ConfirmationDialog from './dialogs/ConfirmationDialog';
import FormLoading from './common/FormLoading';
import api from '../utils/api';


function ModalForm({isModalOpen, OnSubmit, mode, onClose, itemData, listCategories, sanitizeInput}) {

  //GET USER INFORMATION
  const { user } = useAuth();


  // CATEGORY OPTIONS (TEMPORARY)

  const [product_name, setItemName] = useState('');
  const [category_id, setCategory] = useState('');
  const [branch_id, setBranch] = useState(''); 
  const [quantity_added, setQuantity] = useState('');
  const [unit_cost, setPurchasedPrice] = useState('');
  const [date_added, setDatePurchased] = useState('');
  const [unit, setUnit] = useState('');
  const [min_threshold, setMinThreshold]= useState('');
  const [max_threshold, setMaxThreshold] = useState('');
  const [unit_price, setPrice] = useState('');
  const [exceedQunatity, setForExeedQuantity] = useState('');
  const [product_validity, setExpirationDate] = useState('');
  const [maxQuant, setMaxQuant] = useState(false);

  // EXISTING PRODUCT SELECTION STATES
  const [existingProducts, setExistingProducts] = useState([]);
  const [selectedExistingProduct, setSelectedExistingProduct] = useState(null);
  const [showExistingProducts, setShowExistingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // INCREMENTAL RENDERING STATE FOR LARGE LISTS
  const [visibleCount, setVisibleCount] = useState(20);
  const BATCH_SIZE = 20;
  const overlayRef = useRef(null);

  //STATES FOR ERROR HANDLING
  const [emptyField, setEmptyField] = useState({});
  const [notANumber, setNotANumber] = useState({});
  const [invalidNumber, setInvalidNumber] = useState({});
  const [isExpiredEarly, setIsExpiredEarly] = useState(false);

  // LOADING STATE
  const [loading, setLoading] = useState(false);


  //FOR DIALOG
  const [openDialog, setDialog] = useState(false);
  const message =  mode === 'add' ? "Are you sure you want to add this ?": "Are you sure you want to edit this ?";


  // FETCH EXISTING PRODUCTS ON MODAL OPEN
  const fetchExistingProducts = async () => {
    try {
      const response = await api.get('/api/items/unique');
      setExistingProducts(response.data);
    } catch (error) {
      console.error('Error fetching existing products:', error);
    }
  };

  //CLEARS THE FORM EVERYTIME THE ADD ITEMS BUTTON IS PRESSED
  useEffect(() => {
    if (!user) return;

    if (isModalOpen && user && user.role && user.role.some(role => ['Inventory Staff'].includes(role))) {
      setInvalidNumber({});
      setIsExpiredEarly(false);
      setEmptyField({});
      setNotANumber({});
      setSelectedExistingProduct(null);
      setSearchTerm('');
      
      if (mode === 'add') {
          setItemName('');
          setCategory('');
          setBranch(user.branch_id);
          setQuantity('');
          setPurchasedPrice('');
          setDatePurchased('');
          setUnit('');
          setMaxThreshold('')
          setMinThreshold('');
          setPrice('');
          setExpirationDate('');
          setMaxQuant(false);
          setForExeedQuantity('');
          
          // FETCH EXISTING PRODUCTS FOR SELECTION
          fetchExistingProducts();
      }

      if (isModalOpen && mode === 'edit' && itemData){
        setItemName(itemData.product_name);
        setCategory(itemData.category_id);
        setBranch(user.branch_id); //BRANCH ID FROM USER INFORMATION
        setQuantity('');
        setPurchasedPrice(itemData.unit_cost);
        setUnit(itemData.unit);
        setMinThreshold(itemData.min_threshold);
        setMaxThreshold(itemData.max_threshold);
        setPrice(itemData.unit_price);
        setForExeedQuantity(itemData.quantity)
        setDatePurchased('');
        setExpirationDate('');
      } 
    }
  }, [isModalOpen, mode, itemData]); 



  const constructionUnits = ["pcs", "ltr", "gal", "bag", "pairs", "roll", "set", "sheet", "kg", "m", "cu.m", "btl", "can", "bd.ft", "meter", "pail"];

  // HANDLE SELECTING AN EXISTING PRODUCT
  const handleSelectExistingProduct = (product) => {
    setSelectedExistingProduct(product);
    setItemName(product.product_name);
    setUnit(product.unit);
    setCategory(product.category_id);
    setShowExistingProducts(false);
  };

  // FILTER EXISTING PRODUCTS BASED ON SEARCH TERM
  const filteredExistingProducts = existingProducts.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // TOGGLE EXISTING PRODUCTS PANEL
  const toggleExistingProductsPanel = () => {
    setShowExistingProducts(!showExistingProducts);
    if (!showExistingProducts) {
      setSearchTerm('');
    }
  };


  // RESET VISIBLE COUNT WHEN SEARCH TERM OR PANEL OPENS/CLOSES
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    
    if (overlayRef.current) {
      overlayRef.current.scrollTop = 0;
    }
  }, [searchTerm, showExistingProducts, existingProducts]);


  const handleThreshold = (quantity, threshold) =>{

    if (mode === 'add'){
      if (Number(quantity) > threshold){
        setMaxQuant(true);
        
      } else{
        setMaxQuant(false);
      }
    }

    if (mode === 'edit'){
      if (Number(exceedQunatity) + Number(quantity) > threshold){
        setMaxQuant(true);
        
      } else{
        setMaxQuant(false);
      }
    }

  }


  // HANDLE SCROLL TO LOAD MORE (FOR PERFORMANCE)
  const handleOverlayScroll = useCallback((e) => {
    const target = e.target;
    if (!target) return;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 120;
    if (nearBottom && visibleCount < filteredExistingProducts.length) {
      setVisibleCount((v) => Math.min(v + BATCH_SIZE, filteredExistingProducts.length));
    }
  }, [visibleCount, filteredExistingProducts.length]);


  const validateInputs = () => {

    // THIS VARIABLES STORE THE ERROR INPUTS
    const isEmptyField = {};
    const isnotANumber = {};
    const invalidNumberValue = {};
  

    //CHECK IF INPUT IS EMPTY
    if (!String(product_name).trim()) isEmptyField.product_name = true;
    if (!String(category_id).trim()) isEmptyField.category_id = true;
    if (!String(quantity_added).trim()) isEmptyField.quantity_added = true;
    if (!String(unit_cost).trim()) isEmptyField.unit_cost = true;
    if (!String(date_added).trim()) isEmptyField.date_added = true;
    if (!String(unit).trim()) isEmptyField.unit = true;
    if (!String(min_threshold).trim()) isEmptyField.min_threshold = true;
    if (!String(max_threshold).trim()) isEmptyField.max_threshold = true;
    if (!String(unit_price).trim()) isEmptyField.unit_price = true;
    if (!String(product_validity).trim()) isEmptyField.product_validity = true;


    //CHECK IF INPUT IS NOT A NUMBER
    if (isNaN(Number(quantity_added))) isnotANumber.quantity_added = true;
    if (isNaN(Number(unit_cost))) isnotANumber.unit_cost = true;
    if (isNaN(Number(min_threshold))) isnotANumber.min_threshold = true;
    if (isNaN(Number(max_threshold))) isnotANumber.max_threshold = true;
    if (isNaN(Number(unit_price))) isnotANumber.unit_price = true;


    //CHECK IF NUMBER IS 0 OR LESS
    if (mode === 'add'){
      if (String(quantity_added).trim() && Number(quantity_added) <= 0) invalidNumberValue.quantity_added = true;

    } else{
      if (String(quantity_added).trim() && Number(quantity_added) < 0) invalidNumberValue.quantity_added = true;
    }
    if (String(unit_cost).trim() && Number(unit_cost) <= 0) invalidNumberValue.unit_cost = true;
    if (String(min_threshold).trim()  && Number(min_threshold) <= 0) invalidNumberValue.min_threshold = true;
    if (String(max_threshold).trim()  && Number(max_threshold) <= 0) invalidNumberValue.max_threshold = true;
    if (String(unit_price).trim() && Number(unit_price) <= 0) invalidNumberValue.unit_price = true;


    //CHECK IF DATE ADDED IS GREATER THAN THE EXPIRY DATE
    const isExpiryEarly = date_added > product_validity;
    setIsExpiredEarly(isExpiryEarly);


    //SET THE VALUES TO THE STATE VARIABLE
    setEmptyField(isEmptyField);
    setNotANumber(isnotANumber);
    setInvalidNumber(invalidNumberValue);


    //STOP SUBMISSION IF INPUT IS INVALID
    if (Object.keys(isEmptyField).length > 0) return; 
    if (Object.keys(isnotANumber).length > 0) return;
    if (Object.keys(invalidNumberValue).length > 0) return;
    if (isExpiryEarly) return;


    setDialog(true)

  };



  //HANDLES THE SUBMIT
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      //RUNS IF THERE ARE NO INVALID INPUTS
      const itemData = {
        product_name,
        category_id: Number(category_id),
        branch_id: Number(branch_id),
        unit,
        unit_price: Number(unit_price),
        unit_cost: Number(unit_cost),
        quantity_added: Number(quantity_added),
        min_threshold: Number(min_threshold),
        max_threshold: Number(max_threshold),
        date_added,
        product_validity,
        userID: user.user_id,
        fullName: user.full_name,
        existing_product_id: selectedExistingProduct?.product_id || null
      };

      //SENDS THE DATA TO App.jsx TO BE SENT TO DATABASE
      await OnSubmit(itemData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };


  const inputClass = (field) => 
    `bg-gray-100 border-gray-300 py-2 px-3 w-full rounded-md border border-2 ${
      emptyField[field] || notANumber[field] || invalidNumber[field] ? 'border-red-500' : ''
  } ${isExpiredEarly && field === 'product_validity' ? 'border-red-500' : ''}`;

  
  const label = (field) => `ml-1 text-[13px]  ${emptyField[field] ? 'text-red-500' : ''} ${isExpiredEarly && field === 'product_validity' ? 'text-red-500' : ''}`;



  const errorflag = (field, field_warn) =>{
    if (emptyField[field])
      return <div className={`italic text-red-500 absolute ${field_warn === 'date' ? 'top-16':'top-9'} pl-2 text-xs mt-1`}>{`Please enter a ${field_warn}!`}</div>

    else if (notANumber[field])
      return <div className="italic text-red-500 absolute top-9 pl-2 text-xs mt-1">Must be a positive number!</div>


    else if (invalidNumber[field])
      return <div className="italic text-red-500 absolute top-9 pl-2 text-xs mt-1">Value must not be less than 1!</div>

    else if (isExpiredEarly && field === 'product_validity')
      return <div className="italic text-red-500 absolute top-16 pl-2 text-xs mt-1">Expiry date must be after purchase date!</div>
      
  };


  return (
    <div>
      {/* Loading overlay */}
      {loading && (
        <FormLoading 
          message={mode === 'add' ? "Adding product..." : "Updating product..."}
        />
      )}

      {openDialog && 
                  
          <ConfirmationDialog
          mode={mode}
          message={message}
          submitFunction={() => {handleSubmit()}}
          onClose={() => {setDialog(false);}}

          />
      
      }

      {isModalOpen && user && user.role && user.role.some(role => ['Inventory Staff'].includes(role)) &&(
        <div
          className="fixed inset-0 bg-black/35 bg-opacity-50 z-40 backdrop-blur-[1px]"
          style={{ pointerEvents: 'auto' }}  onClick={() => {onClose(); 
          setMaxQuant(false);}}
        />
       )}



        <dialog className="bg-transparent fixed top-0 bottom-0  z-50" open={isModalOpen && user && user.role && user.role.some(role => ['Inventory Staff'].includes(role))}>
      <div className="relative flex flex-col border border-gray-600/40 bg-white h-[600px] w-[760px] rounded-md p-7 animate-popup" >


              <div>
                <h3 className="font-bold text-3xl py-4 text-center">
                  {mode === 'edit' ? 'EDIT ITEM' : 'ADD ITEM'}
                </h3>
              </div>



              <div className="pb-4 pt-2 px-8">
                {/*FORMS */}
                <form onSubmit={(e) => {e.preventDefault(); validateInputs();}}>
                
                <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
                  onClick={() => {onClose(); setShowExistingProducts(false); 
          setMaxQuant(false);}}>✕</button>


                {/*PRODUCT NAME*/}
                <div className='relative'>
                  <div className="flex gap-2">
                    <input 
                      id='item' 
                      type="text"  
                      placeholder='Item Name' 
                      className={`${inputClass('product_name')} ${selectedExistingProduct ? 'border-green-500 bg-green-50' : ''} disabled:cursor-not-allowed`}
                      value={product_name}  
                      onChange={(e) => setItemName(sanitizeInput(e.target.value))} 
                      disabled={selectedExistingProduct || mode === 'edit'}
                    />
                    
                    {mode === 'add' && (
                      <button
                        type="button"
                        onClick={toggleExistingProductsPanel}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${
                          showExistingProducts 
                            ? 'bg-red-500 text-white hover:bg-red-600' 
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {showExistingProducts ? 'Cancel' : 'Browse'}
                      </button>
                    )}
                  </div>

                  {selectedExistingProduct && (
                    <div className="text-xs text-green-600 mt-1">
                      Selected existing product (ID: {selectedExistingProduct.product_id})
                      <button 
                        type="button" 
                        onClick={() => {
                          setSelectedExistingProduct(null);
                          setItemName('');
                          setUnit('');
                          setCategory('');
                        }}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {errorflag('product_name', 'product name')}

                  {/* EXISTING PRODUCTS PANEL (OVERLAY) */}
                  {mode === 'add' && showExistingProducts && (
                    <div ref={overlayRef} onScroll={handleOverlayScroll} className="absolute left-0 top-full mt-2 border border-gray-300 rounded-md p-4 bg-white max-h-96 overflow-y-auto w-[640px] max-w-[80vw] shadow-lg z-50">
                      <div className="mb-3">
                        <input
                          type="text"
                          placeholder="Search existing products..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        {filteredExistingProducts.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center py-4">
                            {searchTerm ? 'No products found matching your search' : 'No existing products available'}
                          </p>
                        ) : (
                        filteredExistingProducts.slice(0, visibleCount).map((product) => (
                            <div
                              key={product.product_id}
                              onClick={() => handleSelectExistingProduct(product)}
                              className="p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-green-50 hover:border-green-300 transition-colors"
                            >
                              <div className="font-medium text-sm">{product.product_name}</div>
                              <div className="text-xs text-gray-600">
                                PRODUCT ID: {product.product_id} • Category: {product.category_name} • Unit: {product.unit}
                              </div>
                              <div className="text-xs text-gray-500">
                                Available in: {product.branches}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between gap-x-5 mt-6">

                    {/* Left column inputs */}
                    <div className="flex flex-col gap-y-6 w-full">


                      {/*CATEGORY*/}
                      <div className='relative'>
                        <select
                          className={inputClass('category_id')}
                          value={category_id}
                          onChange={(e) => setCategory(e.target.value)}
                        >

                          <option value="" >Select Category</option>
                            {listCategories.map((option) => (
                              <option key={option.category_id} value={option.category_id}>{option.category_name}</option>
                            ))}

                        </select>

                        {errorflag('category_id', 'category')}

                      </div>

                      
                      {/*QUANTITY ADDED*/}
                      <div className='relative'>

                        <input
                          placeholder={`${mode === 'add' ? 'Quantity': 'Add Quantity or Enter 0'}`}
                          className={inputClass('quantity_added')}
                          value={quantity_added}
                          onChange={(e) => {
                            const value = e.target.value;
                            setQuantity(value);
                            handleThreshold(value, max_threshold);

                          }}
                        />

                        {errorflag('quantity_added', 'value')}

                        {maxQuant && <div className='absolute text-xs italic pl-2 text-red-500'>Quantity exceeding max threshold!</div>}

                      </div>


                      {/*UNIT COST*/}
                      <div className='relative'>

                        <input
                          placeholder="Cost"
                          className={inputClass('unit_cost')}
                          value={unit_cost}
                          onChange={(e) => setPurchasedPrice(e.target.value)}
                        />

                        {errorflag('unit_cost', 'value')}

                      </div>


                      {/*DATE ADDED*/}
                      <div className='relative'>
                        
                        <label htmlFor="date_added" className={label('date_added')}>Enter Date Added</label>
                        
                        <input
                          id="date_added"
                          type="date"
                          placeholder="Date Purchased"
                          className={inputClass('date_added')}
                          value={date_added}
                          onChange={(e) => setDatePurchased(e.target.value)}
                        />

                        {errorflag('date_added', 'date')}

                      </div>

                    </div>


                    {/* Right column inputs */}
                    <div className="flex flex-col gap-y-6 w-full">


                      {/*UNIT*/}
                      <div className='relative'>


                        <select
                          className={`${inputClass('unit')}`}
                          value={unit}
                          onChange={(e) => setUnit(sanitizeInput(e.target.value))}
                          
                        >

                          <option value="" >Select Unit</option>
                            {constructionUnits.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}

                        </select>

                         {errorflag('unit', 'unit')}

                      </div>


                      {/*MIN AND MAX THRESHOLD*/}
                      <div className='relative flex space-x-2'> 

                        <input
                          placeholder="Min Threshold"
                          className={inputClass('min_threshold')}
                          value={min_threshold}
                          onChange={(e) => setMinThreshold(e.target.value)}
                        />

                        {errorflag('max_threshold', 'value')}

                        <input
                          placeholder="Max Threshold"
                          className={inputClass('max_threshold')}
                          value={max_threshold}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMaxThreshold(value);
                            handleThreshold(quantity_added, value);
                            
                          }}
                        />

                        {errorflag('min_threshold', 'value')}

                      </div>

                            
                      {/*PRICE*/}
                      <div className='relative'>

                         <input
                            placeholder="Price"
                            className={inputClass('unit_price')}
                            value={unit_price}
                            onChange={(e) => setPrice(e.target.value)}
                          />

                          {errorflag('unit_price', 'value')}

                      </div>


                      {/*PROCT VALIDITY*/}
                      <div className='relative'>

                        <label htmlFor="product_validity" className={label('product_validity')}>Enter Product Validity</label>

                        <input
                          id="product_validity"
                          type="date"
                          placeholder="Expiration Date"
                          className={inputClass('product_validity')}
                          value={product_validity}
                          onChange={(e) => setExpirationDate(e.target.value)}
                        />

                        {errorflag('product_validity', 'date')}

                      </div>

                    </div>

                </div>

                <div className="absolute left-1/2 transform -translate-x-1/2 flex justify-end bottom-9">

                    {/*CONTROL MODAL*/}
                    <button type="submit" disabled={maxQuant} className={`${mode === 'edit' ? 'bg-yellow-400' :'bg-green-600'} rounded-lg text-white px-5 py-2 text-bottom disabled:cursor-not-allowed`} > 
                      {mode === 'edit' ? 'UPDATE' : 'ADD'}
                    </button>

                </div>

               </form>

              </div>

            </div>

        </dialog>

    </div>

  )

}



export default ModalForm