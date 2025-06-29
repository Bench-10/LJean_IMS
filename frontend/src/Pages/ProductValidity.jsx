import {React, useState, useEffect } from 'react';
import { RiErrorWarningLine } from "react-icons/ri";
import axios from 'axios';

function ProductValidity({ sanitizeInput }) {
  const [productValidityList, setValidity] = useState([]);
  const [searchValidity, setSearchValidity] = useState('');
  

  const getProductInfo = async () =>{
    try {
      const data = await axios.get('http://localhost:3000/api/product_validity/');
      setValidity(data.data);
    } catch (error) {
      console.log(error.message);
      
    }
  }

  useEffect(() =>{
      getProductInfo();
  }, []);


  
  
  const handleSearch = (event) =>{
    setSearchValidity(sanitizeInput(event.target.value));

  }


  const filteredValidityData = productValidityList.filter(validity =>

    validity.product_name.toLowerCase().includes(searchValidity.toLowerCase()) ||
    validity.category_name.toLowerCase().includes(searchValidity.toLowerCase()) ||
    validity.formated_date_added.toLowerCase().includes(searchValidity.toLowerCase()) ||
    validity.formated_product_validity.toLowerCase().includes(searchValidity.toLowerCase()) 
    
  );



  
  return (
    <div className=" ml-[220px] p-8 max-h-screen" >
        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          PRODUCT VALIDITY
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>

        {/*SEARCH AND ADD*/}
        <div className='flex w-full'>
          {/*SEARCH */}
          <div className='w-[400px]'>
            
            <input
              type="text"
              placeholder="Search Date Item Name or Category"
              className={`border outline outline-1 outline-gray-400 focus:outline-green-700 focus:py-2 transition-all px-3 py-2 rounded w-full h-9`}
              onChange={handleSearch}
             
            />

          </div>

          {/*EXPIRY LABEL*/}
          <div  className="ml-auto flex gap-4 mr-14">
            
            {/*NEAR EXPIRY DIV*/}
            <div className='flex gap-4 align-middle'>
              <span className="relative pl-6 content-center before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-4 before:h-4 before:rounded before:bg-[#FFF3C1]">
                Near Expiry
              </span>
            </div>


            {/*EXPIRED DIV*/}
           <div className='flex gap-4'>
              <span className="relative pl-6 content-center before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-4 before:h-4 before:rounded before:bg-[#FF3131]">
                Expired
              </span>
            </div>

          </div>
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        <div className="overflow-x-auto  overflow-y-auto h-[560px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className="w-full divide-y divide-gray-200  text-sm">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-56">
                    DATE PURCHASED
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-56">
                    EXPIRY DATE
                  </th>
                  <th className="bg-green-500 pl-7 pr-4 py-2 text-left text-sm font-medium text-white">
                    ITEM NAME
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-72">
                    CATEGORY
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white w-56">
                    QUANTITY BOUGHT
                  </th>
                  
               
              </tr>
            </thead>

            
            <tbody className="bg-white">

            {filteredValidityData.map((validity, index) => (

                 
  
                  <tr
                    key={index}
                    className={
                      validity.expy
                        ? 'bg-[#FF3131] text-white hover:bg-[#FF3131]/90 h-14'
                        : validity.near_expy
                        ? 'bg-[#FFF3C1] hover:bg-yellow-100 h-14'
                        : 'hover:bg-gray-200/70 h-14'
                    }
                  >

                    <td className="px-4 py-2 text-center"  >{validity.formated_date_added}</td>
                    <td className="px-4 py-2 text-center font-medium whitespace-nowrap" >{validity.formated_product_validity}</td>
                    <td className="pl-7 pr-4 py-2 text-left whitespace-nowrap" >{validity.product_name}</td>
                    <td className="px-4 py-2 text-center "  >{validity.category_name}</td>
                    <td className="px-4 py-2 text-center"  >{validity.quantity_added}</td>
                    
                  </tr>
              
            ))}
            </tbody>

          </table>


        

   
      </div>

      </div>
    

  )
}

export default ProductValidity