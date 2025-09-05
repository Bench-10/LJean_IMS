import React, { useState, useEffect } from 'react'
import { useAuth } from '../authentication/Authentication';
import ConfirmationDialog from './dialogs/ConfirmationDialog';


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
  const [threshold, setThreshold] = useState('');
  const [unit_price, setPrice] = useState('');
  const [product_validity, setExpirationDate] = useState('');


  //STATES FOR ERROR HANDLING
  const [emptyField, setEmptyField] = useState({});
  const [notANumber, setNotANumber] = useState({});
  const [invalidNumber, setInvalidNumber] = useState({});
  const [isExpiredEarly, setIsExpiredEarly] = useState(false);


  //FOR DIALOG
  const [openDialog, setDialog] = useState(false);
  const message =  mode === 'add' ? "Are you sure you want to add this ?": "Are you sure you want to edit this ?";


  //CLEARS THE FORM EVERYTIME THE ADD ITEMS BUTTON IS PRESSED
  useEffect(() => {
    if (!user) return;


    if (isModalOpen && user.role.some(role => ['Inventory Staff'].includes(role))) {
      setInvalidNumber({});
      setIsExpiredEarly(false);
      setEmptyField({});
      setNotANumber({});
      if (mode === 'add') {
          setItemName('');
          setCategory('');
          setBranch(user.branch_id);
          setQuantity('');
          setPurchasedPrice('');
          setDatePurchased('');
          setUnit('');
          setThreshold('');
          setPrice('');
          setExpirationDate('');
      }

      if (isModalOpen && mode === 'edit' && itemData){
        setItemName(itemData.product_name);
        setCategory(itemData.category_id);
        setBranch(user.branch_id); //BRANCH ID FROM USER INFORMATION
        setQuantity('');
        setPurchasedPrice(itemData.unit_cost);
        setUnit(itemData.unit);
        setThreshold(itemData.threshold);
        setPrice(itemData.unit_price);
        setDatePurchased('');
        setExpirationDate('');
      } 
    }
  }, [isModalOpen, mode, itemData]); 



  const constructionUnits = [
    "kg",  
    "g",  
    "ton", 
    "lb", 
    "pc",   
    "bag",   
    "roll",  
    "sheet", 
    "bndl",  
    "set", 
    "lot",  
    "can",   
    "drum"  
  ];



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
    if (!String(threshold).trim()) isEmptyField.threshold = true;
    if (!String(unit_price).trim()) isEmptyField.unit_price = true;
    if (!String(product_validity).trim()) isEmptyField.product_validity = true;


    //CHECK IF INPUT IS NOT A NUMBER
    if (isNaN(Number(quantity_added))) isnotANumber.quantity_added = true;
    if (isNaN(Number(unit_cost))) isnotANumber.unit_cost = true;
    if (isNaN(Number(threshold))) isnotANumber.threshold = true;
    if (isNaN(Number(unit_price))) isnotANumber.unit_price = true;


    //CHECK IF NUMBER IS 0 OR LESS
    if (mode === 'add'){
      if (String(quantity_added).trim() && Number(quantity_added) <= 0) invalidNumberValue.quantity_added = true;

    } else{
      if (String(quantity_added).trim() && Number(quantity_added) < 0) invalidNumberValue.quantity_added = true;
    }
    if (String(unit_cost).trim() && Number(unit_cost) <= 0) invalidNumberValue.unit_cost = true;
    if (String(threshold).trim()  && Number(threshold) <= 0) invalidNumberValue.threshold = true;
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
  

    //RUNS IF THERE ARE NO INVALID INPUTS
    const itemData = {
      product_name,
      category_id: Number(category_id),
      branch_id: Number(branch_id),
      unit,
      unit_price: Number(unit_price),
      unit_cost: Number(unit_cost),
      quantity_added: Number(quantity_added),
      threshold: Number(threshold),
      date_added,
      product_validity
    };


    //SENDS THE DATA TO App.jsx TO BE SENT TO DATABASE
    await OnSubmit(itemData);
    onClose();
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

      {openDialog && 
                  
          <ConfirmationDialog
          mode={mode}
          message={message}
          submitFunction={() => {handleSubmit()}}
          onClose={() => {setDialog(false);}}

          />
      
      }

      {isModalOpen && user.role.some(role => ['Inventory Staff'].includes(role)) &&(
        <div
          className="fixed inset-0 bg-black/35 bg-opacity-50 z-40 backdrop-blur-[1px]"
          style={{ pointerEvents: 'auto' }}  onClick={onClose}
        />
       )}



        <dialog className="bg-transparent fixed top-0 bottom-0  z-50" open={isModalOpen && user.role.some(role => ['Inventory Staff'].includes(role))}>
            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[555px] w-[600px] rounded-md p-7 animate-popup" >


              <div>
                <h3 className="font-bold text-3xl py-4 text-center">
                  {mode === 'edit' ? 'EDIT ITEM' : 'ADD ITEM'}
                </h3>
              </div>



              <div className="pb-4 pt-2 px-8">
                {/*FORMS */}
                <form onSubmit={(e) => {e.preventDefault(); validateInputs();}}>
                
                <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
                  onClick={onClose}>✕</button>


                {/*PRODUCT NAME*/}
                <div className='relative'>

                  <input 
                    id='item' 
                    type="text"  
                    placeholder='Item Name' 
                    className={inputClass('product_name')}  
                    value={product_name}  
                    onChange={(e) => setItemName(sanitizeInput(e.target.value))} 
                  />

                  {errorflag('product_name', 'product name')}

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
                          onChange={(e) => setQuantity(e.target.value)}
                        />

                        {errorflag('quantity_added', 'value')}

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
                          className={inputClass('unit')}
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


                      {/*THRESHOLD*/}
                      <div className='relative'> 

                        <input
                          placeholder="Threshold"
                          className={inputClass('threshold')}
                          value={threshold}
                          onChange={(e) => setThreshold(e.target.value)}
                        />

                        {errorflag('threshold', 'value')}

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
                    <button type="submit" className={`${mode === 'edit' ? 'bg-yellow-400' :'bg-green-600'} rounded-lg text-white px-5 py-2 text-bottom`} > 
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