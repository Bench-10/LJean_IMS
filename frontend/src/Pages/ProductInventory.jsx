import React, {useState }from 'react'

function ProductInventory({handleOpen}) {

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

  const data = [
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      phone: "123-456-7890",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
      country: "USA",
      status: "Active",
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "987-654-3210",
      address: "456 Oak Ave",
      city: "Los Angeles",
      state: "CA",
      zip: "90001",
      country: "USA",
      status: "Inactive",
    },
    {
      id: 3,
      name: "Alice Johnson",
      email: "alice@example.com",
      phone: "555-123-4567",
      address: "789 Pine Rd",
      city: "Chicago",
      state: "IL",
      zip: "60601",
      country: "USA",
      status: "Active",
    },
    {
      id: 4,
      name: "Bob Williams",
      email: "bob@example.com",
      phone: "555-987-6543",
      address: "321 Maple St",
      city: "Houston",
      state: "TX",
      zip: "77001",
      country: "USA",
      status: "Inactive",
    }
  ];


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
        <div className="overflow-x-auto  overflow-y-auto max-h-[570px] bg-red rounded-sm">
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
              {data.map((row, rowIndex) => (
                
               
                <tr key={rowIndex} className={(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}>
                  <td className="px-4 py-2"  >{row.id}</td>
                  <td className="px-4 py-2"  >{row.name}</td>
                  <td className="px-4 py-2"  >{row.email}</td>
                  <td className="px-4 py-2"  >{row.phone}</td>
                  <td className="px-4 py-2"  >{row.address}</td>
                  <td className="px-4 py-2"  >{row.city}</td>
                  <td className="px-4 py-2"  >{row.state}</td>
                  <td className="px-4 py-2"  >{row.zip}</td>
                  <td className="px-4 py-2 text-center"  >
                    <div className='border rounded-full px-5 py-1 bg-[#61E85C] text-green-700 font-medium'>
                      {row.country }
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button className="bg-blue-600 px-5 py-1 rounded-md text-white" onClick={() => handleOpen('edit')}>
                        Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  )
}

export default ProductInventory;