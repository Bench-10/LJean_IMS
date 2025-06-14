import React from 'react'

function ProductTransactionHistory({isProductTransactOpen, onClose}) {

  const historyDummy = [
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },
    {
      date_added: "20204-05-05",
      product_name: "Bolt",
      category_name: "Construction Supply",
      price: 2.00,
      quantity: 300
    },

  ]



  return (
    <div>
      
      {isProductTransactOpen && <div className='fixed inset-0 bg-black/35 bg-opacity-50 z-40'/>}

      <dialog className='bg-transparent fixed top-0 bottom-0  z-50' open={isProductTransactOpen}>

          <div className="relative flex flex-col border border-gray-600/40 bg-white h-[600px] w-[1000px] rounded-md p-7 pb-14 border-gray-300 animate-popup">
            <button type='button' className="btn-sm btn-circle btn-ghost absolute right-2 top-2 " 
              onClick={() => {onClose();}}>✕</button>

              {/*TITLE AND FILTER SECTION*/}
              <div className='flex justify-between items-center mt-2' >
                <h1 className='font-bold text-4xl'>Product History</h1>

                <div className=''>
                  filter
                </div>
              </div>

              {/*HISTORY TABLE SECTION*/}
              <div className='overflow-x-auto overflow-y-auto w-full h-[77%] mt-8 rounded-lg shadow-sm border border-gray-200  hide-scrollbar '> 
                <table className='w-full' >
                  <thead className='sticky top-0 h-10'>
                    <tr className='bg-gray-200'>
                      <th className='px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider'>Date</th>
                      <th className='px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider'>Item Name</th>
                      <th className='px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider'>Category</th>
                      <th className='px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider'>Price</th>
                      <th className='px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider'>Quantity</th>
                      <th className='px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider'>Value</th>
                    </tr>
                  </thead>
                  <tbody className='bg-white '>
                    {historyDummy.map((history, histoindx) => (
                      <tr key={histoindx} className='hover:bg-gray-100 transition-colors'>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>{history.date_added}</td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>{history.product_name}</td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>{history.category_name}</td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'>${history.price.toFixed(2)}</td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'>{history.quantity}</td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'>${(history.price * history.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
    
              {/*EXPORT BUTTON*/}
              <div>

              </div>



          </div>

            
      </dialog>
    </div>
  )
}

export default ProductTransactionHistory