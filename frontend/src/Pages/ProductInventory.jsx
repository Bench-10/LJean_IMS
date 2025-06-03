import React, {useState }from 'react'

function ProductInventory() {

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
    },
    {
      id: 5,
      name: "Carol Brown",
      email: "carol@example.com",
      phone: "555-222-3333",
      address: "654 Cedar Ave",
      city: "Phoenix",
      state: "AZ",
      zip: "85001",
      country: "USA",
      status: "Active",
    },
    {
      id: 6,
      name: "David Lee",
      email: "david@example.com",
      phone: "555-444-5555",
      address: "987 Spruce Dr",
      city: "Philadelphia",
      state: "PA",
      zip: "19101",
      country: "USA",
      status: "Inactive",
    },
    {
      id: 7,
      name: "Eva Green",
      email: "eva@example.com",
      phone: "555-666-7777",
      address: "246 Birch Ln",
      city: "San Antonio",
      state: "TX",
      zip: "78201",
      country: "USA",
      status: "Active",
    },
    {
      id: 8,
      name: "Frank Harris",
      email: "frank@example.com",
      phone: "555-888-9999",
      address: "135 Willow Way",
      city: "San Diego",
      state: "CA",
      zip: "92101",
      country: "USA",
      status: "Inactive",
    },
    {
      id: 9,
      name: "Grace Kim",
      email: "grace@example.com",
      phone: "555-000-1111",
      address: "753 Aspen Ct",
      city: "Dallas",
      state: "TX",
      zip: "75201",
      country: "USA",
      status: "Active",
    },
    {
      id: 10,
      name: "Henry Clark",
      email: "henry@example.com",
      phone: "555-222-4444",
      address: "159 Elm St",
      city: "San Jose",
      state: "CA",
      zip: "95101",
      country: "USA",
      status: "Inactive",
    },
    {
      id: 11,
      name: "Ivy Martinez",
      email: "ivy@example.com",
      phone: "555-333-5555",
      address: "852 Oak Cir",
      city: "Austin",
      state: "TX",
      zip: "73301",
      country: "USA",
      status: "Active",
    },
    {
      id: 12,
      name: "Jack Turner",
      email: "jack@example.com",
      phone: "555-444-6666",
      address: "951 Pine Pl",
      city: "Jacksonville",
      state: "FL",
      zip: "32099",
      country: "USA",
      status: "Inactive",
    },
    {
      id: 13,
      name: "Karen Scott",
      email: "karen@example.com",
      phone: "555-555-7777",
      address: "357 Redwood Blvd",
      city: "Fort Worth",
      state: "TX",
      zip: "76101",
      country: "USA",
      status: "Active",
    },
    {
      id: 14,
      name: "Leo Adams",
      email: "leo@example.com",
      phone: "555-666-8888",
      address: "468 Cypress St",
      city: "Columbus",
      state: "OH",
      zip: "43085",
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

        <hr className="mt-3 mb-10 border-t-4 border-green-800"/>


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
            <button className='border border-[#63FF4F] text-[#63FF4F] font-medium hover:bg-[#63FF4F] hover:text-white px-5 rounded-md transition-all'>ADD ITEMS</button>

          </div>
          

        </div>

        <hr className="border-t-2 my-6 w-full border-gray-500"/>

        {/*TABLE */}
        <div className="overflow-x-auto  overflow-y-auto h-120 bg-red rounded-sm">
          <table className="w-full divide-y divide-gray-200 shadow  text-sm">
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
                  <td className="px-4 py-2">{row.id}</td>
                  <td className="px-4 py-2">{row.name}</td>
                  <td className="px-4 py-2">{row.email}</td>
                  <td className="px-4 py-2">{row.phone}</td>
                  <td className="px-4 py-2">{row.address}</td>
                  <td className="px-4 py-2">{row.city}</td>
                  <td className="px-4 py-2">{row.state}</td>
                  <td className="px-4 py-2">{row.zip}</td>
                  <td className="px-4 py-2">
                    <div className='border rounded-full px-5 bg-[#61E85C] text-green-900' >
                      {row.country }
                    </div>
                  </td>
                  <td className="px-4 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  )
}

export default ProductInventory;