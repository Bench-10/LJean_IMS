import React, { useState, useEffect } from 'react'


function ModalForm({isOpen, OnSubmit, mode, onClose, itemData}) {
  const options = ['1', '2'];

  const [product_name, setItemName] = useState('');
  const [category_id, setCategory] = useState('');
  const [branch_id, setBranch] = useState('1');
  const [quantity_added, setQuantity] = useState('');
  const [unit_cost, setPurchasedPrice] = useState('');
  const [date_added, setDatePurchased] = useState('');
  const [unit, setUnit] = useState('');
  const [threshold, setThreshold] = useState('');
  const [unit_price, setPrice] = useState('');
  const [product_validity, setExpirationDate] = useState('');

  
  const [emptyField, setEmptyField] = useState({});
  const [notANumber, setNotANumber] = useState({});

  useEffect(() => {
  if (isOpen) {
    setEmptyField({});
    setNotANumber({});
    setItemName('');
    setCategory('');
    setBranch('1');
    setQuantity('');
    setPurchasedPrice('');
    setDatePurchased('');
    setUnit('');
    setThreshold('');
    setPrice('');
    setExpirationDate('');
  }
}, [isOpen]); 

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isEmptyField = {};
    const isnotANumber = {};
  
   
   

    //CHECK IF INPUT IS EMPTY
    if (!product_name.trim()) isEmptyField.product_name = true;
    if (!category_id.trim()) isEmptyField.category_id = true;
    if (!quantity_added.trim()) isEmptyField.quantity_added = true;
    if (!unit_cost.trim()) isEmptyField.unit_cost = true;
    if (!date_added.trim()) isEmptyField.date_added = true;
    if (!unit.trim()) isEmptyField.unit = true;
    if (!threshold.trim()) isEmptyField.threshold = true;
    if (!unit_price.trim()) isEmptyField.unit_price = true;
    if (!product_validity.trim()) isEmptyField.product_validity = true;


    //CHECK IF INPUT IS NOT A NUMBER
    if (isNaN(quantity_added)) isnotANumber.quantity_added = true;
    if (isNaN(unit_cost)) isnotANumber.unit_cost = true;
    if (isNaN(threshold)) isnotANumber.threshold = true;
    if (isNaN(unit_price)) isnotANumber.unit_price = true;

    setEmptyField(isEmptyField);
    setNotANumber(isnotANumber);

    //  STOP SUBMISSION IF INPUT IS INVALID
    if (Object.keys(isEmptyField).length > 0) return;
    if (Object.keys(isnotANumber).length > 0) return; 

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

    await OnSubmit(itemData);
    onClose();
  };


  const inputClass = (field) =>
    `bg-gray-100 border-gray-300 py-2 px-3 w-full rounded-md border border-t-2 ${
      emptyField[field] || notANumber[field] ? 'border-red-500' : ''
  }`;




  return (
    <div>
     
        <dialog className="bg-transparent fixed top-0 bottom-0 " open={isOpen}>
            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[500px] w-[600px] rounded-md p-7 animate-popup" >
              <div>
                <h3 className="font-bold text-3xl py-4 text-center">
                  {mode === 'edit' ? 'EDIT ITEM' : 'ADD ITEM'}
                </h3>
              </div>

              <div className="pb-4 pt-2 px-8">
                {/*FORMS */}
                <form method="dialog" onSubmit={handleSubmit}>
                
                <button className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
                  onClick={onClose}>✕</button>

                <div className='relative'>

                  <input type="text" placeholder='Item Name' className={inputClass('product_name')}  value={product_name}  onChange={(e) => setItemName(e.target.value)} />

                  {emptyField['product_name'] && (
                    <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please enter a product name!</div>
                  )}

                </div>

               

                <div className="flex justify-between gap-x-5 mt-5">
                    <div className="flex flex-col gap-y-5 w-full">

                      {/* Left column inputs */}

                      <div className='relative'>
                        <select
                        className={inputClass('category_id')}
                        value={category_id}
                        onChange={(e) => setCategory(e.target.value)}
                        >
                          <option value="" >Select Category</option>
                          {options.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>

                        {emptyField['category_id'] && (
                          <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please select a category!</div>
                        )}

                      </div>
                      

                      <div className='relative'>
                        <input
                          type="text"
                          placeholder="Quantity"
                          className={inputClass('quantity_added')}
                          value={quantity_added}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                        {notANumber['quantity_added'] && (
                          <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Must be a positive number!</div>
                        )}

                        {emptyField['quantity_added'] && (
                          <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please enter a value!</div>
                        )}

                     </div>

                     <div className='relative'>
                       <input
                        type="text"
                        placeholder="Purchase Price"
                        className={inputClass('unit_cost')}
                        value={unit_cost}
                        onChange={(e) => setPurchasedPrice(e.target.value)}
                        />

                        {notANumber['unit_cost'] && (
                          <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Must be a positive number!</div>
                        )}

                        {emptyField['unit_cost'] && (
                          <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please enter a value!</div>
                        )}

                      </div>


                      <div className='relative'>
                         <input
                            type="date"
                            placeholder="Date Purchased"
                            className={inputClass('date_added')}
                            value={date_added}
                            onChange={(e) => setDatePurchased(e.target.value)}
                          />

                          {emptyField['date_added'] && (
                            <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please select a date!</div>
                          )}
                      </div>

    
                  

              


                    </div>

                    <div className="flex flex-col gap-y-5 w-full">

                      {/* Right column inputs */}


                      <div className='relative'>
                        <input
                          type="text"
                          placeholder="Unit"
                          className={inputClass('unit')}
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                        />

                         {emptyField['unit'] && (
                            <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please enter a value!</div>
                         )}

                      </div>

                      <div className='relative'> 
                        <input
                          type="text"
                          placeholder="Threshold"
                          className={inputClass('threshold')}
                          value={threshold}
                          onChange={(e) => setThreshold(e.target.value)}
                        />

                        {notANumber['threshold'] && (
                          <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Must be a positive number!</div>
                        )}

                        {emptyField['threshold'] && (
                          <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please enter a value!</div>
                        )}

                      </div>

                      
                      <div className='relative'>
                         <input
                            type="text"
                            placeholder="Price"
                            className={inputClass('unit_price')}
                            value={unit_price}
                            onChange={(e) => setPrice(e.target.value)}
                          />


                          {notANumber['unit_price'] && (
                            <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Must be a positive number!</div>
                          )}

                          {emptyField['unit_price'] && (
                            <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please enter a value!</div>
                          )}

                      </div>

                      <div className='relative'>
                        <input
                          type="date"
                          placeholder="Expiration Date"
                          className={inputClass('product_validity')}
                          value={product_validity}
                          onChange={(e) => setExpirationDate(e.target.value)}
                        />

                        {emptyField['product_validity'] && (
                            <div className="text-red-500 absolute top-9 pl-2 text-xs mt-1">Please select a date!</div>
                        )}



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