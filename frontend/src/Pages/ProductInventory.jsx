import React, { useEffect, useState }from 'react';
import axios from 'axios';


function ProductInventory({handleOpen, setProductsData, productsData}) {

  const productColumns = [
    "ITEM_ID",
    "ITEM NAME",
    "CETEGORY",
    "UNIT",
    "UNITPRICE",
    "UNITCOST",
    "QUANTITY",
    "THRESHOLD",
    "STATUS",
    "ACTION",
  ];

  
  const [error, setError] = useState();
  const [searchItem, setSearchItem] = useState('');

  const handleSearch = (event) =>{
    setSearchItem(event.target.value);

  }
  

  const filteredData = productsData.filter(product =>
    product.product_name.toLowerCase().includes(searchItem.toLowerCase())
  );


  return (
   
      
      <div className=" ml-[225px] p-8 max-h-screen" >
        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          INVENTORY
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>


        {/*SEARCH AND ADD*/}
        <div className='flex w-full'>
          {/*SEARCH */}
          <div>
            <input
              type="text"
              placeholder="Search"
              className="border border-gray-400 focus:border-blue-500 px-3 py-2 rounded w-full h-9"
              onChange={handleSearch}
            />

          </div>

          {/*CATEGORIES AND ADD ITEM */}
          <div  className="ml-auto flex gap-4">
            
            {/*CATEGORIES BTN*/}
            <button className='border border-[#61CBE0] text-[#61CBE0] font-medium hover:bg-[#61CBE0] hover:text-white px-5 rounded-md transition-all'>CATEGORIES</button>


            {/*ADD ITEM BTN*/}
            <button className='border border-[#63FF4F] text-[#63FF4F] font-medium hover:bg-[#63FF4F] hover:text-white px-5 rounded-md transition-all' onClick={() => handleOpen('add')}>ADD ITEMS</button>

          </div>
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        {/*TABLE */}
        <div className="overflow-x-auto  overflow-y-auto max-h-[550px] bg-red rounded-sm hide-scrollbar">
          <table className="w-full divide-y divide-gray-200  shadow  text-sm">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                {productColumns.map((col, idx) => (
                  <th
                    key={idx}
                    className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredData.map((row, rowIndex) => (
                
               
                <tr key={rowIndex} className={(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}>
                  <td className="px-4 py-2"  >{row.product_id}</td>
                  <td className="px-4 py-2"  >{row.product_name}</td>
                  <td className="px-4 py-2"  >{row.category_id}</td>
                  <td className="px-4 py-2"  >{row.unit}</td>
                  <td className="px-4 py-2"  >{row.unit_price}</td>
                  <td className="px-4 py-2"  >{row.unit_cost}</td>
                  <td className="px-4 py-2"  >{row.quantity}</td>
                  <td className="px-4 py-2"  >{row.threshold}</td>
                  <td className="px-4 py-2 text-center w-36"  >
                    <div className={`border rounded-full px-5 py-1 font- ${row.quantity <= row.threshold ? 'bg-[#f05959] text-red-900' : 'bg-[#61E85C] text-green-700'} font-medium`}>
                      {row.quantity <= row.threshold ? 'Low Stock' : 'In Stock'}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button className="bg-blue-600 px-5 py-1 rounded-md text-white" onClick={() => handleOpen('edit', row)}>
                        Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
           {error && <div className="flex font-bold justify-center px-4 py-4">{error}</div>} 
        </div>
      </div>
  )
}

export default ProductInventory;