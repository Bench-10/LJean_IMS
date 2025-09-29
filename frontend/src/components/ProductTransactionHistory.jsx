import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { BsFunnelFill } from "react-icons/bs";
import { TbFileExport } from "react-icons/tb";
import NoInfoFound from './common/NoInfoFound.jsx';
import { useAuth } from '../authentication/Authentication';
import {currencyFormat} from '../utils/formatCurrency.js';
import ChartLoading from './common/ChartLoading.jsx';
import { exportToCSV, exportToPDF, formatForExport } from "../utils/exportUtils";
 
function ProductTransactionHistory({isProductTransactOpen, onClose, sanitizeInput }) {

  const [openFilter, setOpenFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productHistory, setProductHistory] = useState([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false)
  
  const {user} = useAuth();


  const closeFilterValue = () =>{
    setOpenFilter(false); 
    setEndDate(''); 
    setStartDate('');
  };

  const handleClose = () =>{
    setSearch('');
    setStartDate('');
    setEndDate('');
    onClose();
    setOpenFilter(false); 
  };


  const applyFilter = () =>  {
    
    if (!startDate && !endDate){
      fetchProductHistory();
      setOpenFilter(false);
      return
    }

    if ((startDate > endDate) && endDate){
      alert('End date must not be before the Start date!');
      return
    }

    if (startDate && !endDate){
      fetchProductHistory();
    }


    fetchProductHistory();
    setOpenFilter(false); 
      
  };


  const fetchProductHistory = async () =>{
      const dates = {startDate, endDate}

      try {
        setLoading(true);
        let response;
        if (!user.role.some(role => ['Owner'].includes(role))){
          response = await api.post(`/api/product_history?branch_id=${user.branch_id}`, dates);
        } else{
          response = await api.post(`/api/product_history/`, dates);
        }
        setProductHistory(response.data);
      } catch (error) {
        setError(error.message);
        
      } finally {
        setLoading(false);
      }
  };


  useEffect(() => {
    if(isProductTransactOpen)
      fetchProductHistory();
  }, [isProductTransactOpen]);


  const handleSearch = (event) =>{
    setSearch(sanitizeInput(event.target.value));

  }


  let currentProductHistory = productHistory;

  
  currentProductHistory = currentProductHistory.filter(product =>
    product.product_name.toLowerCase().includes(search.toLowerCase())
  );

  // Export functionality
  const handleExportHistory = (format) => {
    const exportData = formatForExport(currentProductHistory, []);
    const filename = `product_history_export_${new Date().toISOString().split('T')[0]}`;
    
    const customHeaders = ['Date Added', 'Product Name', 'Category', 'Cost', 'Quantity'];
    const dataKeys = ['formated_date_added', 'product_name', 'category_name', 'h_unit_cost', 'quantity_added'];
    
    if (format === 'csv') {
      exportToCSV(exportData, filename, customHeaders, dataKeys);
    } else if (format === 'pdf') {
      exportToPDF(exportData, filename, {
        title: 'Product Transaction History Report',
        customHeaders: customHeaders,
        dataKeys: dataKeys
      });
    }
  };




  return (
    <div>
      
      {isProductTransactOpen && <div className='fixed inset-0 bg-black/35 bg-opacity-50 z-40 backdrop-blur-[1px]' onClick={() => {onClose(); closeFilterValue();}}/>}

      <dialog className='bg-transparent fixed top-0 bottom-0  z-50' open={isProductTransactOpen}>

          <div className="relative flex flex-col border border-gray-600/40 bg-white h-[600px] w-[1000px] rounded-md p-7 pb-14 border-gray-300 animate-popup">
            <button type='button' className=" absolute right-2 top-2 " 
              onClick={() => {onClose(); setOpenFilter(false); closeFilterValue(); handleClose();}}>✕</button>

              {/*TITLE AND FILTER SECTION*/}
              <div className='flex  justify-between items-center mt-2 pr-6' >
                <div className='flex flex-col sm:flex-row gap-2 sm:gap-x-8 items-center w-full'>
                  <h1 className='font-bold text-3xl sm:text-4xl text-gray-800 tracking-tight'>Product History</h1>
                  <div className='flex items-center w-full sm:w-auto mt-2 sm:mt-0'>
                   
                    <input 
                      type="text" 
                      className='h-9 w-full sm:w-64 border border-gray-300 rounded-md px-3 py-1 text-sm ' 
                      placeholder="Search product name..."
                      onChange={handleSearch} 
                      value={search}
                    />
                  </div>
                </div>
                
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
                <table className='w-full h-full' >
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
                  <tbody className='bg-white relative'>
                    { loading ? (
                        <tr>
                          <td colSpan={6}>
                            <ChartLoading message="Loading product history..." />
                          </td>
                        </tr>
                      ) : 
                      (currentProductHistory.length === 0 ?
                        (
                          <NoInfoFound col={6}/>
                        ) :

                        (
                          currentProductHistory.map((history, histoindx) => (
                            <tr key={histoindx} className='hover:bg-gray-100 transition-colors'>
                              <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>{history.formated_date_added}</td>
                              <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>{history.product_name}</td>
                              <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>{history.category_name}</td>
                              <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'> {currencyFormat(history.h_unit_cost)}</td>
                              <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'>{history.quantity_added.toLocaleString()}</td>
                              <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right'>{currencyFormat(history.value)}</td>
                            </tr>
                          ))
                        )
                      )
                    }
                   
                  </tbody>
                </table>
              </div>
    
              {/*EXPORT BUTTON*/}
              <div className='flex justify-end mt-4'>
                <div className="relative group">
                  <button className='bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2 rounded-md transition-all flex items-center gap-2'>
                    <TbFileExport />Export History
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button 
                      onClick={() => handleExportHistory('csv')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
                    >
                      Export as CSV
                    </button>
                    <button 
                      onClick={() => handleExportHistory('pdf')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm whitespace-nowrap"
                    >
                      Export as PDF
                    </button>
                  </div>
                </div>
              </div>



          </div>

            
      </dialog>
    </div>
  )
}

export default ProductTransactionHistory