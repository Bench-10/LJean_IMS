import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BsFunnelFill } from "react-icons/bs";
import NoInfoFound from '../utils/NoInfoFound';
import { useAuth } from '../authentication/Authentication';
 
function ProductTransactionHistory({isProductTransactOpen, onClose, }) {

  const [openFilter, setOpenFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productHistory, setProductHistory] = useState([]);

  const {user} = useAuth();


  const closeFilterValue = () =>{
    setOpenFilter(false); 
    setEndDate(''); 
    setStartDate('');
  };


  const applyFilter = () =>  {
    
    if (!startDate && !endDate){
      setOpenFilter(false);
      return
    }

    if ((startDate > endDate) && endDate){
      alert('End date must not be before the Start date!');
      return
    }

    if ((startDate > endDate) && !endDate){
      fetchProductHistory();
    }

    fetchProductHistory();
    setOpenFilter(false); 
      
  };


  const fetchProductHistory = async () =>{
      const dates = {startDate, endDate}

      try {
        let response;
        if (user.role !== 'Owner'){
          response = await axios.post(`http://localhost:3000/api/product_history?branch_id=${user.branch_id}`, dates);
        } else{
          response = await axios.post(`http://localhost:3000/api/product_history/`, dates);
        }
        setProductHistory(response.data);
      } catch (error) {
        setError(error.message);
        
      }
  };


  useEffect(() => {
    if(isProductTransactOpen)
      fetchProductHistory();
  }, [isProductTransactOpen]);


  return (
    <div>
      
      {isProductTransactOpen && <div className='fixed inset-0 bg-black/35 bg-opacity-50 z-40' onClick={() => {onClose(); closeFilterValue();}}/>}

      <dialog className='bg-transparent fixed top-0 bottom-0  z-50' open={isProductTransactOpen}>

          <div className="relative flex flex-col border border-gray-600/40 bg-white h-[600px] w-[1000px] rounded-md p-7 pb-14 border-gray-300 animate-popup">
            <button type='button' className=" absolute right-2 top-2 " 
              onClick={() => {onClose(); setOpenFilter(false); closeFilterValue();}}>✕</button>

              {/*TITLE AND FILTER SECTION*/}
              <div className='flex  justify-between items-center mt-2 pr-6' >
                <h1 className='font-bold text-4xl'>Product History</h1>
                <div className='relative'>

                  {/*FILTER POPUP */}
                  <dialog className='absolute bg-transparent rounded-md flex-col z-50 bg-white top-[80%] left-[-700%]' open={openFilter}>
                    <div className=' w-[160px] h-[210px]  border rounded-md px-3 py-4 shadow-md text-xs'>
                     <h1 className='font-bold text-md'>Filter</h1>

                     <div className='w-full mt-3'>
                      <h2 className='font-semibold'>Start date</h2>
                      <input 
                        type="date"  
                        value={startDate}
                        className='border mt-1 p-1 w-full rounded-sm'
                        onChange={(e) => setStartDate(e.target.value)}
                      />

                     </div>

                     <div className='w-full mt-3'>
                      <h2 className='font-semibold'>End date</h2>
                      <input 
                        type="date" 
                        value={endDate}
                        className='border mt-1 p-1 w-full rounded-sm' 
                        onChange={(e) => setEndDate(e.target.value)}
                      />

                     </div>

                     <div className='w-full mt-4 text-center'>
                      <button className='bg-gray-800 py-1 px-4 text-white hover:bg-gray-700 border rounded-md' onClick={applyFilter}>Apply</button>
                     </div>
                  </div>
                  </dialog>
                  

                  <button className='' onClick={() => {openFilter ? closeFilterValue() : setOpenFilter(true)}}>
                     <BsFunnelFill className='w-6 h-7 hover:text-gray-800'/> 
                  </button>
                </div>
              </div>

              {/*HISTORY TABLE SECTION*/}
              <div className='overflow-x-auto overflow-y-auto w-full h-[77%] mt-8 rounded-lg shadow-sm border border-gray-200  hide-scrollbar '> 
                <table className='w-full' >
                  <thead className='sticky top-0 h-10 z-40'>
                    <tr className='bg-gray-200'>
                      <th className='px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider'>Date</th>
                      <th className='px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider'>Item Name</th>
                      <th className='px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider'>Category</th>
                      <th className='px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider'>Unit Cost</th>
                      <th className='px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider'>Quantity</th>
                      <th className='px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider'>Value</th>
                    </tr>
                  </thead>
                  <tbody className='bg-white '>
                    {productHistory.length === 0 ?
                      (
                        <NoInfoFound col={6}/>
                      ) :

                      (
                        productHistory.map((history, histoindx) => (
                          <tr key={histoindx} className='hover:bg-gray-100 transition-colors'>
                            <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>{history.formated_date_added}</td>
                            <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>{history.product_name}</td>
                            <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>{history.category_name}</td>
                            <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'>₱ {history.h_unit_cost}</td>
                            <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'>{history.quantity_added}</td>
                            <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'>₱ {history.value}</td>
                          </tr>
                        ))
                      )
                    }
                   
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