import React from 'react';
import { useAuth } from '../authentication/Authentication';
import NoInfoFound from '../utils/NoInfoFound';

function Sales({setIsModalOpen, saleHeader}) {

  const {user} = useAuth();

  return (
    <div className=' ml-[220px] px-8 py-2 max-h-screen'>


        <h1 className=' text-4xl font-bold text-green-900'>
          SALES TRANSACTIONS
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
              
            />

          </div>


          {/*APEAR ONLY IF THE USER ROLE IS SALES ASSOCIATE */}
          {user.role === 'Sales Associate' &&
          
            <div  className="ml-auto flex gap-4">


              {/*ADD SALE BTN*/}
              <button className='border border-[#63FF4F] text-[#63FF4F] font-medium hover:bg-[#63FF4F] hover:text-white px-5 rounded-md transition-all'  onClick={() => setIsModalOpen(true)}> ADD SALE</button>

            </div>

          }
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>

        <div className="overflow-x-auto  overflow-y-auto h-[560px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className="w-full divide-y divide-gray-200  text-sm">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-24">
                    SALE ID
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">
                    CHARGE TO
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">
                    TIN
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white w-36">
                    ADDRESS
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-32">
                    DATE
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-32">
                    AMOUNT NET VAT
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-28">
                    VAT
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-right text-sm font-medium text-white w-28">
                    TOTAL AMOUNT
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-28">
                    ACTION
                  </th>

              </tr>
            </thead>

            
            <tbody className="bg-white">

              {saleHeader.length === 0 ? 
                (
                  <NoInfoFound col={10}/>
                ) : 

                (
                  saleHeader.map((row, rowIndex) => (
                
                    <tr key={rowIndex} className={`hover:bg-gray-200/70 h-14 ${(rowIndex + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}`}>
                      <td className="px-4 py-2 text-center"  >{row.sales_information_id}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap"  >{row.charge_to}</td>
                      <td className="px-4 py-2 whitespace-nowrap"  >{row.tin}</td>
                      <td className="px-4 py-2"  >{row.address}</td>
                      <td className="px-4 py-2 text-right"  >{row.formated_date}</td>
                      <td className="px-4 py-2 text-right"  >₱ {row.amount_net_vat}</td>
                      <td className="px-4 py-2 text-right"  >₱ {row.vat}</td>
                      <td className="px-4 py-2 text-right"  >₱ {row.total_amount_due}</td>
                      <td className="px-4 py-2 text-center">
                        <button className="bg-blue-600 hover:bg-blue-700 px-5 py-1 rounded-md text-white" >
                            View
                        </button>
                      </td>

                    </tr>
                  ))
                ) 
              }
              
            </tbody>
          </table>
        </div>


        
    </div>
  )
}

export default Sales