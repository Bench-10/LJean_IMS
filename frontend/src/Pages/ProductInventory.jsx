import React, { useState }from 'react';
import NoInfoFound from '../components/common/NoInfoFound.jsx';
import InAppNotificationPopUp from '../components/dialogs/InAppNotificationPopUp.jsx';
import { useAuth } from '../authentication/Authentication';
import {currencyFormat} from '../utils/formatCurrency.js';
import InventoryItemDetailsDialog from '../components/InventoryItemDetailsDialog.jsx';


function ProductInventory({branches, handleOpen, productsData, setIsCategory, setIsProductTransactOpen, sanitizeInput, listCategories, openInAppNotif, mode, message}) {
  
  const {user} = useAuth();
  const [error, setError] = useState();
  const [searchItem, setSearchItem] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(() => user && user.role.some(role => ['Branch Manager'].includes(role)) ? user.branch_id : '' );

  // NEW: DIALOG STATE
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleSearch = (event) =>{
    setSearchItem(sanitizeInput(event.target.value));

  }

  // OPEN DETAILS DIALOG ON ROW CLICK
  const openDetails = (item) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedItem(null);
  };


  //CONTAINS ALL AVAILABLE PRODUCTS WHEN LOADED
  let filteredProducts = productsData;

  //FILTER BY CATEGORY
  filteredProducts = selectedCategory
  ? filteredProducts.filter(item => item.category_id === Number(selectedCategory))
  : filteredProducts;

  //FILTER BY BRANCH
  filteredProducts = selectedBranch
  ? filteredProducts.filter(item => item.branch_id === Number(selectedBranch))
  : filteredProducts;

  

  //FILTER BY SEARCH
  const filteredData = filteredProducts.filter(product => 
    product.product_name.toLowerCase().includes(searchItem.toLowerCase())
    
  );


  return (
   
      
      <div className=" ml-[220px] px-8 py-2 max-h-screen" >

        {openInAppNotif &&
            <InAppNotificationPopUp 
              title={mode}
              message={message}
            
            />
        }


        {/* DETAILS DIALOG */}
        <InventoryItemDetailsDialog
          open={isDetailsOpen}
          onClose={closeDetails}
          user={user}
          item={selectedItem}
    
        />
        

        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          INVENTORY
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>


        {/*SEARCH AND ADD*/}
        <div className='flex w-full '>
          <div className='flex gap-x-9'>
              {/*SEARCH */}
              <div className='w-[400px]'>
                
                <input
                  type="text"
                  placeholder="Search Item Name or Category"
                  className="border outline outline-1 outline-gray-400 focus:outline-green-700 transition-all px-3 py-0 rounded w-full h-9 leading-none align-middle"
                  onChange={handleSearch}
                />

              </div>

              <div className='flex gap-x-3 items-center h-9'>
                <div className="relative w-44">
                  <label className="absolute left-1 top-[-11px] bg-white px-1 text-xs font-medium text-gray-700 pointer-events-none transition-all">Filter by Category:</label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="border outline outline-1 outline-gray-400 focus:outline-green-700 transition-all px-3 py-0 rounded w-full h-9 leading-none align-middle text-sm"
                  >
                    <option value="">All Categories</option>
                    {listCategories.map(cat => (
                      <option key={cat.category_id} value={cat.category_id}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(user.role.some(role => ['Branch Manager', 'Owner'].includes(role))) &&

                <div className="relative w-44">
                  <label className="absolute left-1 top-[-11px] bg-white px-1 text-xs font-medium text-gray-700 pointer-events-none transition-all">Filter by Branch:</label>
                  <select
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                    className="border outline outline-1 outline-gray-400 focus:outline-green-700 transition-all px-3 py-0 rounded w-full h-9 leading-none align-middle text-sm"
                  >
                    {user.role.some(role => ['Owner'].includes(role)) && <option value="">All Branch</option>}
                    {branches.map(branch => (
                      <option key={branch.branch_id} value={branch.branch_id}>
                        {branch.branch_name}{branch.branch_id === user.branch_id ? ' (Your Branch)':''}
                      </option>
                    ))}
                  </select>
                </div>
              
              }   

          </div>
          

          {/*CATEGORIES AND ADD ITEM */}
          {/*APEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
          {user.role.some(role => ['Inventory Staff'].includes(role)) &&
          
            <div  className="ml-auto flex gap-4">
              
              {/*CATEGORIES BTN*/}
              <button className='bg-[#007278] text-white font-medium hover:bg-[#009097] px-5 rounded-md transition-all' onClick={() => setIsCategory(true)}>CATEGORIES</button>


              {/*ADD ITEM BTN*/}
              <button className='bg-[#119200] text-white font-medium hover:bg-[#63FF4F] px-5 rounded-md transition-all' onClick={() => handleOpen('add')}>ADD ITEMS</button>

            </div>

          }
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        {/*TABLE */}
        <div className="overflow-x-auto  overflow-y-auto h-[560px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className={`w-full ${filteredData.length === 0 ? 'h-full' : ''} divide-y divide-gray-200  text-sm`}>
            <thead className="sticky top-0 bg-gray-100 ">
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

                  {user.role.some(role => ['Branch Manager'].includes(role)) &&

                    <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                      UNIT COST
                    </th> 

                  }

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
                  {user.role.some(role => ['Inventory Staff'].includes(role)) &&

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
                
                    <tr key={rowIndex} className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}`} onClick={() => openDetails(row)} style={{cursor:'pointer'}}>
                      <td className="px-4 py-2 text-center"  >{row.product_id}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.product_name}</td>
                      <td className="px-4 py-2 whitespace-nowrap"  >{row.category_name}</td>
                      <td className="px-4 py-2"  >{row.unit}</td>
                      <td className="px-4 py-2 text-right"  >{currencyFormat(row.unit_price)}</td>

                      {user.role.some(role => ['Branch Manager'].includes(role)) &&
                        <td className="px-4 py-2 text-right"  >{currencyFormat(row.unit_cost)}</td>
                      }
                      
                      <td className="px-4 py-2 text-right"  >{row.quantity.toLocaleString()}</td>
                      <td className="px-4 py-2 text-center"  >{row.threshold.toLocaleString()}</td>
                      <td className="px-4 py-2 text-center w-36"  >
                        <div className={`border rounded-full px-5 py-1 font- ${row.quantity <= row.threshold ? 'bg-[#f05959] text-red-900' : 'bg-[#61E85C] text-green-700'} font-medium`}>
                          {row.quantity <= row.threshold ? 'Low Stock' : 'In Stock'}
                        </div>
                      </td>

                      {/*APEAR ONLY IF THE USER ROLE IS INVENTORY STAFF */}
                      {user.role.some(role => ['Inventory Staff'].includes(role)) &&

                        <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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