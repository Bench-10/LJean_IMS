
import React, { useState } from 'react'


function ModalForm({isOpen, OnSubmit, mode, onClose, itemData}) {

  const options =['apple', 'lemon', 'banana'];

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasedPrice, setPurchasedPrice] = useState('');
  const [datePurchased, setDatePurchased] = useState('');
  const [unit, setUnit] = useState('');
  const [threshold, setThreshold] = useState('');
  const [price, setPrice] = useState('');
  const [expirationDate, setExpirationDate] = useState('');


  const handleSubmit = async (e) =>{
    e.preventDefault();
    try {
      const itemData = {itemName, category, quantity, purchasedPrice, datePurchased, unit, threshold, price, expirationDate};

      await OnSubmit(itemData); 
    } catch (error) {
      console.log("Error adding client", error);
      
    }
    
    onClose();
  }

  return (
    <div>
     
        <dialog className="bg-transparent fixed top-0 bottom-0 " open={isOpen}>
          
            <div className="relative flex flex-col border border-gray-600/40 bg-white h-[500px] w-[600px] rounded-md p-7 animate-popup" onSubmit={handleSubmit}>
              <div>
                <h3 className="font-bold text-3xl py-4 text-center">
                  {mode === 'edit' ? 'EDIT ITEM' : 'ADD ITEM'}
                </h3>
              </div>

              <div className="pb-4 pt-2 px-8">
                {/*FORMS */}
                <form method="dialog">
                
                <button className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " onClick={onClose}>✕</button>

                <input type="text" placeholder='Item Name' className="bg-gray-100 py-2 px-3 w-full rounded-md border border-t-2 border-gray-300"  value={itemName}  onChange={(e) => setItemName(e.target.value)} />

                <div className="flex justify-between gap-x-5 mt-5">
                    <div className="flex flex-col gap-y-5 w-full">

                       {/* Left column inputs */}
                      <select type="text" placeholder="Category" className="bg-gray-100 py-2 px-3 rounded-md border border-t-2 border-gray-300" value={category}  onChange={(e) => setCategory(e.target.value)}>

                        {options.map((option) => (
                          <option key={option} >{option}</option>

                          )
                        )};

                      </select>

                      <input type="text" placeholder="Quantity" className="bg-gray-100 py-2 px-3 rounded-md border border-t-2 border-gray-300" value={quantity}  onChange={(e) => setQuantity(e.target.value)}/>

                      <input type="text" placeholder="Purchase Price" className="bg-gray-100 py-2 px-3 rounded-md border border-t-2 border-gray-300" value={purchasedPrice}  onChange={(e) => setPurchasedPrice(e.target.value)} />

                      <input type="text" placeholder="Date Purchased" className="bg-gray-100 py-2 px-3 rounded-md border border-t-2 border-gray-300" value={datePurchased}  onChange={(e) => setDatePurchased(e.target.value)}/>


                    </div>

                    <div className="flex flex-col gap-y-5 w-full">

                      {/* Right column inputs */}

                      <input type="text" placeholder="Unit" className="bg-gray-100 py-2 px-3 rounded-md border border-t-2 border-gray-300" value={unit}  onChange={(e) => setUnit(e.target.value)}/>

                      <input type="text" placeholder="Threshold" className="bg-gray-100 py-2 px-3 rounded-md border border-t-2 border-gray-300" value={threshold}  onChange={(e) => setThreshold(e.target.value)}/>

                      <input type="text" placeholder="Price" className="bg-gray-100 py-2 px-3 rounded-md border border-t-2 border-gray-300" value={price}  onChange={(e) => setPrice(e.target.value)}/>

                      <input type="text" placeholder="Expiration Date" className="bg-gray-100 py-2 px-3 rounded-md border border-t-2 border-gray-300" value={expirationDate}  onChange={(e) => setExpirationDate(e.target.value)}/>

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