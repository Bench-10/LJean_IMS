import React from 'react'

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
  ];


  return (

     <div className="bg-black ml-[225px]">
      <div className="overflow-x-auto p-6 bg-red">
        <table className="w-full divide-y divide-gray-200 shadow rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              {productColumns.map((col, idx) => (
                <th
                  key={idx}
                  className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-gray-600"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="px-4 py-2">{row.id}</td>
                <td className="px-4 py-2">{row.name}</td>
                <td className="px-4 py-2">{row.email}</td>
                <td className="px-4 py-2">{row.phone}</td>
                <td className="px-4 py-2">{row.address}</td>
                <td className="px-4 py-2">{row.city}</td>
                <td className="px-4 py-2">{row.state}</td>
                <td className="px-4 py-2">{row.zip}</td>
                <td className="px-4 py-2">{row.country}</td>
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