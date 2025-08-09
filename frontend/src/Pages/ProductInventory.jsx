import React, { useState }from 'react';
import NoInfoFound from '../utils/NoInfoFound';
import { useAuth } from '../authentication/Authentication';


function ProductInventory({handleOpen, productsData, setIsCategory, setIsProductTransactOpen, sanitizeInput}) {
  
  const {user} = useAuth();
  const [error, setError] = useState();
  const [searchItem, setSearchItem] = useState('');

  const handleSearch = (event) =>{
    setSearchItem(sanitizeInput(event.target.value));

  }


  const filteredData = productsData.filter(product => 
    product.product_name.toLowerCase().includes(searchItem.toLowerCase()) ||
    product.category_name.toLowerCase().includes(searchItem.toLowerCase())
    
  );


  return (
   
      
      <div className=" ml-[220px] p-8 max-h-screen" >
        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          INVENTORY
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>


        {/*SEARCH AND ADD*/}
        <div className='flex w-full'>
          {/*SEARCH */}
          <div className='w-[400px]'>
            
            <input
              type="text"
              placeholder="Search Item Name or Category"
              className="border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9"
              onChange={handleSearch}
            />

          </div>

          {/*CATEGORIES AND ADD ITEM */}
          {/*APEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
          {user.role === 'Inventory Staff' &&
          
            <div  className="ml-auto flex gap-4">
              
              {/*CATEGORIES BTN*/}
              <button className='border border-[#61CBE0] text-[#61CBE0] font-medium hover:bg-[#61CBE0] hover:text-white px-5 rounded-md transition-all' onClick={() => setIsCategory(true)}>CATEGORIES</button>


              {/*ADD ITEM BTN*/}
              <button className='border border-[#63FF4F] text-[#63FF4F] font-medium hover:bg-[#63FF4F] hover:text-white px-5 rounded-md transition-all' onClick={() => handleOpen('add')}>ADD ITEMS</button>

            </div>

          }
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        {/*TABLE */}
        <div className="overflow-x-auto  overflow-y-auto h-[560px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className="w-full divide-y divide-gray-200  text-sm">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-24">
                    ITEM ID
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white">
                    ITEM NAME
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-48">
                    CATEGORY
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-3">
                    UNIT
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                    UNIT PRICE
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                    UNIT COST
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-4">
                    QUANTITY
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-4">
                    THRESHOLD
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-38">
                    STATUS
                  </th>

                  {/*APEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
                  {user.role === 'Inventory Staff' &&

                    <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-20">
                      ACTION
                    </th>

                  }
               
              </tr>
            </thead>

            
            <tbody className="bg-white">

              {filteredData.length === 0 ? 
                (
                  <NoInfoFound col={10}/>
                ) : 

                (
                  filteredData.map((row, rowIndex) => (
                
                    <tr key={rowIndex} className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}`}>
                      <td className="px-4 py-2 text-center"  >{row.product_id}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.product_name}</td>
                      <td className="px-4 py-2 whitespace-nowrap"  >{row.category_name}</td>
                      <td className="px-4 py-2"  >{row.unit}</td>
                      <td className="px-4 py-2 text-right"  >₱ {row.unit_price}</td>
                      <td className="px-4 py-2 text-right"  >₱ {row.unit_cost}</td>
                      <td className="px-4 py-2 text-right"  >{row.quantity}</td>
                      <td className="px-4 py-2 text-center"  >{row.threshold}</td>
                      <td className="px-4 py-2 text-center w-36"  >
                        <div className={`border rounded-full px-5 py-1 font- ${row.quantity <= row.threshold ? 'bg-[#f05959] text-red-900' : 'bg-[#61E85C] text-green-700'} font-medium`}>
                          {row.quantity <= row.threshold ? 'Low Stock' : 'In Stock'}
                        </div>
                      </td>

                      {/*APEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
                      {user.role === 'Inventory Staff' &&

                        <td className="px-4 py-2 text-center">
                          <button className="bg-blue-600 hover:bg-blue-700 px-5 py-1 rounded-md text-white" onClick={() => handleOpen('edit', row)}>
                              Edit
                          </button>
                        </td>

                      }
                      
                    </tr>
                  ))
                ) 
              }
              
            </tbody>
          </table>
           {error && <div className="flex font-bold justify-center px-4 py-4">{error}</div>} 
        </div>

        <div className='flex justify-end mt-3 px-3 '>

          <button className=' rounded-md border border-gray-800 hover:bg-gray-800/80 hover:text-white transition-all py-2 px-5 text-sm' onClick={() => setIsProductTransactOpen(true)}>
            Show Inventory History
          </button>

        </div>

      </div>
  )
}

export default ProductInventory;