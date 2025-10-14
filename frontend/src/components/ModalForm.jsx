import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../authentication/Authentication';
import ConfirmationDialog from './dialogs/ConfirmationDialog';
import FormLoading from './common/FormLoading';
import api from '../utils/api';
import { getQuantityStep, validateQuantity, getQuantityPlaceholder, allowsFractional } from '../utils/unitConversion';


function ModalForm({isModalOpen, OnSubmit, mode, onClose, itemData, listCategories, sanitizeInput}) {

  //GET USER INFORMATION
  const { user } = useAuth();


  // CATEGORY OPTIONS (TEMPORARY)

  const [product_name, setItemName] = useState('');
  const [category_id, setCategory] = useState('');
  const [branch_id, setBranch] = useState(''); 
  const [quantity_added, setQuantity] = useState(0);
  const [unit_cost, setPurchasedPrice] = useState('');
  const [date_added, setDatePurchased] = useState('');
  const [unit, setUnit] = useState('');
  const [min_threshold, setMinThreshold]= useState('');
  const [max_threshold, setMaxThreshold] = useState('');
  const [unit_price, setPrice] = useState('');
  const [exceedQunatity, setForExeedQuantity] = useState('');
  const [product_validity, setExpirationDate] = useState('');
  const [maxQuant, setMaxQuant] = useState(false);
  const [description, setDescription] = useState('');
  
  
  const [editChoice, setEditChoice] = useState(null); 

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
  const [unitValidationError, setUnitValidationError] = useState({});

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
      setUnitValidationError({});
      setSelectedExistingProduct(null);
      setSearchTerm('');
      // reset edit choice when modal opens
      setEditChoice(null);
      
      if (mode === 'add') {
          setItemName('');
          setCategory('');
          setBranch(user.branch_id);
          setQuantity(0);
          setPurchasedPrice('');
          setDatePurchased('');
          setUnit('');
          setMaxThreshold('')
          setMinThreshold('');
          setPrice('');
          setExpirationDate('');
          setMaxQuant(false);
          setForExeedQuantity('');
          setDescription('');
          
          // FETCH EXISTING PRODUCTS FOR SELECTION
          fetchExistingProducts();
      }

      if (isModalOpen && mode === 'edit' && itemData){
        setItemName(itemData.product_name);
        setCategory(itemData.category_id);
        setBranch(user.branch_id); //BRANCH ID FROM USER INFORMATION
        setQuantity(0);
        setPurchasedPrice(itemData.unit_cost);
        setUnit(itemData.unit);
        setMinThreshold(itemData.min_threshold);
        setMaxThreshold(itemData.max_threshold);
        setPrice(itemData.unit_price);
        setForExeedQuantity(itemData.quantity)
        setDatePurchased('');
        setExpirationDate('');
        setDescription(itemData.description);
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
    setDescription(product.description);
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
    const unitValidationErrors = {};
  

    //CHECK IF INPUT IS EMPTY
    if (mode === 'edit' && editChoice === 'addStocks') {
      // only require quantity and unit_cost (and date) for add-stocks flow
      if (!String(quantity_added).trim()) isEmptyField.quantity_added = true;
      if (!String(unit_cost).trim()) isEmptyField.unit_cost = true;
      if (!String(date_added).trim()) isEmptyField.date_added = true;
      if (!String(product_validity).trim()) isEmptyField.product_validity = true;
    } else {
      if (!String(product_name).trim()) isEmptyField.product_name = true;
      if (!String(category_id).trim()) isEmptyField.category_id = true;
      if (!String(quantity_added).trim()) isEmptyField.quantity_added = true;
      if (!String(unit_cost).trim()) isEmptyField.unit_cost = true;
      if (!String(unit).trim()) isEmptyField.unit = true;
      if (!String(min_threshold).trim()) isEmptyField.min_threshold = true;
      if (!String(max_threshold).trim()) isEmptyField.max_threshold = true;
      if (!String(unit_price).trim()) isEmptyField.unit_price = true;
    }


    //CHECK IF INPUT IS NOT A NUMBER
    if (mode === 'edit' && editChoice === 'addStocks') {
      if (isNaN(Number(quantity_added))) isnotANumber.quantity_added = true;
      if (isNaN(Number(unit_cost))) isnotANumber.unit_cost = true;
    } else {
      if (isNaN(Number(quantity_added))) isnotANumber.quantity_added = true;
      if (isNaN(Number(unit_cost))) isnotANumber.unit_cost = true;
      if (isNaN(Number(min_threshold))) isnotANumber.min_threshold = true;
      if (isNaN(Number(max_threshold))) isnotANumber.max_threshold = true;
      if (isNaN(Number(unit_price))) isnotANumber.unit_price = true;
    }


    //CHECK IF NUMBER IS 0 OR LESS
    if (mode === 'add'){
      if (String(quantity_added).trim() && Number(quantity_added) <= 0) invalidNumberValue.quantity_added = true;
    } else{
      if (String(quantity_added).trim() && Number(quantity_added) < 0) invalidNumberValue.quantity_added = true;
    }


    if (String(unit_cost).trim() && Number(unit_cost) <= 0) invalidNumberValue.unit_cost = true;


    if (!(mode === 'edit' && editChoice === 'addStocks')) {
      if (String(min_threshold).trim()  && Number(min_threshold) <= 0) invalidNumberValue.min_threshold = true;
      if (String(max_threshold).trim()  && Number(max_threshold) <= 0) invalidNumberValue.max_threshold = true;
      if (String(unit_price).trim() && Number(unit_price) <= 0) invalidNumberValue.unit_price = true;
    }


    //CHECK IF DATE ADDED IS GREATER THAN THE EXPIRY DATE
    const isExpiryEarly = date_added > product_validity;
    setIsExpiredEarly(isExpiryEarly);

    // NEW: Unit-aware quantity validation
    if (unit && quantity_added && !isNaN(Number(quantity_added))) {
      const validation = validateQuantity(Number(quantity_added), unit);
      if (!validation.valid) {
        unitValidationErrors.quantity_added = validation.error;
      }
    }

    //SET THE VALUES TO THE STATE VARIABLE
    setEmptyField(isEmptyField);
    setNotANumber(isnotANumber);
    setInvalidNumber(invalidNumberValue);
    setUnitValidationError(unitValidationErrors);


    //STOP SUBMISSION IF INPUT IS INVALID
    if (Object.keys(isEmptyField).length > 0) return; 
    if (Object.keys(isnotANumber).length > 0) return;
    if (Object.keys(invalidNumberValue).length > 0) return;
    if (Object.keys(unitValidationErrors).length > 0) return;
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
        requestor_roles: user.role,
        existing_product_id: selectedExistingProduct?.product_id || null,
        description,
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


  const inputClass = (field) => {
    const hasError = emptyField[field] || notANumber[field] || invalidNumber[field] || (isExpiredEarly && field === 'product_validity');
    return `w-full py-3 px-4 rounded-lg bg-white border ${hasError ? 'border-red-500 ring-1 ring-red-50' : 'border-gray-200'} text-sm placeholder-gray-400 shadow-sm focus:outline-none transition focus:shadow-outline disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${hasError ? 'focus:ring-red-500' : 'focus:ring-indigo-500'}`;
  };

  
  const label = (field) => `block text-xs font-medium mb-1 ${emptyField[field] ? 'text-red-600' : 'text-gray-600'} ${isExpiredEarly && field === 'product_validity' ? 'text-red-600' : ''}`;



  const errorflag = (field, field_warn) =>{
    if (emptyField[field])
      return <p className="mt-1 text-xs text-red-600">{`Please enter a ${field_warn}!`}</p>;

    if (notANumber[field])
      return <p className="mt-1 text-xs text-red-600">Must be a positive number!</p>;

    if (invalidNumber[field])
      return <p className="mt-1 text-xs text-red-600">Value must not be less than 1!</p>;

    if (isExpiredEarly && field === 'product_validity')
      return <p className="mt-1 text-xs text-red-600">Expiry date must be after purchase date!</p>;

    return null;
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


      {/* When editing, prompt the user to choose action before showing edit fields */}
      {isModalOpen && mode === 'edit' && !editChoice && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">

          <div className="bg-white rounded-md p-6 shadow-2xl w-[640px]">

            <h4 className="font-semibold text-2xl mb-6">Choose an action</h4>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => setEditChoice('edit')} className="p-4 border 
              border-gray-100 rounded-lg hover:shadow-md text-left">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 010 2.828l-9.9 9.9a1 1 0 01-.464.263l-4 1a1 1 0 01-1.213-1.213l1-4a1 1 0 01.263-.464l9.9-9.9a2 2 0 012.828 0z"/></svg>
                  <span className="font-medium">Edit Product Data</span>

                </div>
                <p className="text-xs text-gray-500 mt-2">Change product attributes such as unit, price, thresholds and description.</p>

              </button>
              <button type="button" onClick={() => setEditChoice('addStocks')} className="p-4 border border-gray-100 rounded-lg hover:shadow-md text-left">
                <div className="flex items-center gap-3">

                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
                  <span className="font-medium">Add Stocks</span>
                </div>

                <p className="text-xs text-gray-500 mt-2">Quickly add stock quantity and cost without changing other product details.</p>
              </button>
            </div>
            <div className="mt-4 text-center">
              <button type="button" onClick={() => { onClose(); setEditChoice(null); setShowExistingProducts(false); setMaxQuant(false); }} className="text-sm text-gray-500 hover:underline">Cancel</button>

            </div>
          </div>

        </div>

      )}

      {isModalOpen && user && user.role && user.role.some(role => ['Inventory Staff'].includes(role)) &&(
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
          style={{ pointerEvents: 'auto' }}  onClick={() => {onClose(); 
          setMaxQuant(false);}}
        />
       )}



        <dialog className="bg-transparent fixed top-0 bottom-0  z-50" open={mode === 'edit' ? isModalOpen && user && user.role && editChoice && user.role.some(role => ['Inventory Staff'].includes(role)) : isModalOpen && user && user.role && user.role.some(role => ['Inventory Staff'].includes(role))}>
  <div className="relative bg-white max-h-[86vh] overflow-y-auto w-full sm:w-[860px] max-w-4xl rounded-md p-8 shadow-2xl border border-gray-100 animate-popup">


              <div className="mb-6">
                <div className="flex items-center justify-between p-4 ">
                  <div>
                    <h3 className="text-2xl font-bold">{mode === 'edit' ? 'Edit Item' : 'Add Item'}</h3>
                    <p className="text-sm opacity-90">{mode === 'edit' ? 'Modify product details or add stock' : 'Create a new product in inventory'}</p>
                  </div>

                  

                </div>
              </div>



              <div className="pb-4 pt-2 px-8">
                {/*FORMS */}
                <form onSubmit={(e) => {e.preventDefault(); validateInputs();}}>
                
                <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
                  onClick={() => {onClose(); setShowExistingProducts(false); 
          setMaxQuant(false);}}>✕</button>


                {/*PRODUCT NAME*/}
                <div className='relative'>
                  <label className={label('product_name')}>Product name</label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
                        </svg>
                      </span>
                      <input 
                        id='item' 
                        type="text"  
                        placeholder='Item Name' 
                        className={`${inputClass('product_name')} pl-10 ${selectedExistingProduct ? 'border-green-500 bg-green-50' : ''}`}
                        value={product_name}  
                        onChange={(e) => setItemName(sanitizeInput(e.target.value))} 
                        disabled={selectedExistingProduct || mode === 'edit'}
                      />
                    </div>
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
                    <div className="mt-2 inline-flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-full px-3 py-1 text-sm">
                      <span className="font-medium">{selectedExistingProduct.product_name}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setSelectedExistingProduct(null);
                          setItemName('');
                          setUnit('');
                          setCategory('');
                        }}
                        className="ml-2 text-sm text-green-700 underline"
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
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
                              className="p-4 border border-gray-100 rounded-lg cursor-pointer hover:shadow-md transform hover:-translate-y-0.5 transition"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-sm">{product.product_name}</div>
                                  <div className="text-xs text-gray-500">{product.category_name} • {product.unit}</div>
                                </div>
                                <div className="text-xs text-gray-400">ID: {product.product_id}</div>
                              </div>
                              <div className="mt-2 text-xs text-gray-400">Available in: {product.branches}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>


                 {/* DESCRIPTION FIELD */}

                {!(mode === 'edit' && editChoice === 'addStocks') && (
                  <div className="mt-4 mb-4">
                    <label className={label('description')}>Description</label>
                    <textarea
                      placeholder="Enter product description"
                      className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[72px] shadow-sm"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      disabled={selectedExistingProduct || mode === 'edit'}
                    />
                  </div>
                )}

                

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

                    {/* Left column inputs */}
                    <div className="flex flex-col gap-y-6 w-full">


                      {/* If user chose addStocks while editing, only show quantity & unit cost (plus date) */}
                      {!(mode === 'edit' && editChoice === 'addStocks') && 
                      
                          <div className='relative'>
                            <label className={label('category_id')}>Category</label>
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
                      }


                      {!(mode === 'edit' && editChoice === 'edit') && 
                          <div className='relative'>
                            <label className={label('quantity_added')}>Quantity</label>
                            <input
                              type="number"
                              step={unit ? getQuantityStep(unit) : "0.001"}
                              min={unit ? getQuantityStep(unit) : "0.001"}
                              placeholder={unit ? getQuantityPlaceholder(unit) : `${mode === 'add' ? 'Quantity': 'Add Quantity or Enter 0'}`}
                              className={inputClass('quantity_added')}
                              value={quantity_added}
                              onChange={(e) => {
                                const value = e.target.value;
                                setQuantity(value);
                                handleThreshold(value, max_threshold);
                              }}
                            />
                            {errorflag('quantity_added', 'value')}
                            {unitValidationError.quantity_added && (
                              <p className="text-red-600 text-xs mt-1">{unitValidationError.quantity_added}</p>
                            )}
                            {maxQuant && <p className='mt-1 text-xs italic text-red-600'>Quantity exceeds the max threshold!</p>}
                          </div>
                      }


                      {!(mode === 'edit' && editChoice === 'edit') && 

                          <div className='relative'>
                            <label className={label('unit_cost')}>Unit cost</label>
                            <input
                              placeholder="Cost"
                              className={inputClass('unit_cost')}
                              value={unit_cost}
                              onChange={(e) => setPurchasedPrice(e.target.value)}
                            />
                            {errorflag('unit_cost', 'value')}
                          </div>
                      }


                      {!(mode === 'edit' && editChoice === 'edit') && 
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
                      }
                    </div>


                    {/* Right column inputs */}
                    <div className="flex flex-col gap-y-6 w-full">


                      {/* If addStocks was chosen, hide product-edit-only fields on the right side */}
                      {!(mode === 'edit' && editChoice === 'addStocks') &&
                      
                          <div className='relative'>
                            <label className={label('unit')}>Unit</label>
                            <select
                              className={`${inputClass('unit')} appearance-none`}
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
                      }

                      {!(mode === 'edit' && editChoice === 'addStocks') &&

                          <div className='relative'>
                            <label className={label('min_threshold')}>Min threshold</label>
                            <input
                              placeholder="Min Threshold"
                              className={inputClass('min_threshold')}
                              value={min_threshold}
                              onChange={(e) => setMinThreshold(e.target.value)}
                            />
                            {errorflag('min_threshold', 'value')}
                            <label className={label('max_threshold')}>Max threshold</label>
                            <input
                              placeholder="Max Threshold"
                              className={`${inputClass('max_threshold')} mt-1`}
                              value={max_threshold}
                              onChange={(e) => {
                                const value = e.target.value;
                                setMaxThreshold(value);
                                handleThreshold(quantity_added, value);
                              }}
                            />
                            {errorflag('max_threshold', 'value')}
                          </div>

                      }

                      {!(mode === 'edit' && editChoice === 'addStocks') &&

                  <div className='relative'>
                    <label className={label('unit_price')}>Price</label>
                    <input
                      placeholder="Price"
                      className={inputClass('unit_price')}
                      value={unit_price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    {errorflag('unit_price', 'value')}
                  </div>
                      }

                      {!(mode === 'edit' && editChoice === 'edit') &&

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
                      
                      }
                    </div>

                </div>

                <div className="mt-6 flex justify-center">
                  <button type="submit" disabled={maxQuant} className={`flex items-center gap-3 ${mode === 'edit' ? 'bg-blue-700' :'bg-green-700'} text-white font-semibold rounded-md px-6 py-2 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed`} >
                    <span>{mode === 'edit' ? 'UPDATE' : 'ADD'}</span>
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