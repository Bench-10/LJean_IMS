import {React, useEffect, useState} from 'react'
import NoInfoFound from '../utils/NoInfoFound';
import { useAuth } from '../authentication/Authentication';
import axios from 'axios';
import ViewingSalesAndDelivery from '../components/ViewingSalesAndDelivery';
import ConfirmationDialog from '../components/dialogs/ConfirmationDialog';




function DeliveryMonitoring({setAddDelivery, getDeliveries, deliveryData, sanitizeInput}) {

  const [search, setSearchDelivery] = useState('');

  const {user} = useAuth();


  //THIS IS TO OPEN THE DETAILED INFORMATION FOR ITEMS IN DELIVERIES
  const [openDeliveryInfo, setOpeneliveryInfo] = useState(false);
  const [modalType, setModalType] = useState("");


  //FOR DIALOG
  const [openDialog, setDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('');
  const [dialogSaleId, setDialogSalesId] = useState('');



  //HEADER INFORMATION FOR DELIVERY
  const [deliveryInfoData, setDeliveryInfoData ] = useState({delivery_id: '', courier_name: '', sale_id: '', address: '', date: ''})


  //VIEW THE PRUDUCTS UNDER SALE ID
  const openDetailes = async (Info) =>{

    setDeliveryInfoData({
      delivery_id: Info.delivery_id, 
      courier_name: Info.courier_name, 
      sale_id: Info.sales_information_id, 
      address: Info.destination_address, 
      date: Info.formated_delivered_date

    });

    setOpeneliveryInfo(true);

  };

  const closeDeliveryProducts = () => {
    setOpeneliveryInfo(false);
    setModalType("")
  
    setDeliveryInfoData({
      sale_id: '', 
      chargeTo: '', 
      tin: '', 
      address: '', 
      date: '', 
      amountNet: '', 
      vat: '', 
      total: ''
    });


  };

  const setToDelivered = async (id) =>{
    
    await axios.put(`http://localhost:3000/api/delivery/${Number(id)}`, { is_delivered: true });

    getDeliveries((prevData) => 
        prevData.map((item) => (item.sales_information_id === Number(id) ? {...item, is_delivered: true} : item))
    );


    
  };


  const handleSearch = (event) =>{
    setSearchDelivery(sanitizeInput(event.target.value));

  }



  //SEARCHING THE ENTIRE LIST OD DELIVERY DATA
  let deliveryInformation = deliveryData;

  const filteredData = deliveryInformation.filter(data => 

    String(data.delivery_id).toLowerCase().includes(search.toLowerCase()) ||
    String(data.sales_information_id).toLowerCase().includes(search.toLowerCase()) ||
    String(data.destination_address).toLowerCase().includes(search.toLowerCase()) ||
    String(data.courier_name).toLowerCase().includes(search.toLowerCase()) || 
    String(data.formated_delivered_date).toLowerCase().includes(search.toLowerCase())


  );


  
  return (
    <div className=" ml-[220px] px-8 py-2 max-h-screen" >


      {openDialog && 
            
          <ConfirmationDialog
            mode={dialogMode}
            message={"Are you sure to set this as delivered ?"}
            submitFunction={() => {setToDelivered(dialogSaleId)}}
            onClose={() => {setDialog(false); setDialogMode('')}}

          />
      
      }

      <ViewingSalesAndDelivery 
        openModal={openDeliveryInfo}
        type={modalType}
        closeModal={() => closeDeliveryProducts()} 
        user={user}
        headerInformation={deliveryInfoData}
        sale_id={deliveryInfoData.sale_id}

      />

        {/*TITLE*/}
        <h1 className=' text-4xl font-bold text-green-900'>
          DELIVERY
        </h1>

        <hr className="mt-3 mb-6 border-t-4 border-green-800"/>


        {/*SEARCH AND ADD*/}
        <div className='flex w-full '>
          <div className='flex gap-x-9'>
              {/*SEARCH */}
              <div className='w-[400px]'>
                
                <input
                  type="text"
                  placeholder="Search Delivery Data"
                  className="border outline outline-1 outline-gray-400 focus:outline-green-700 transition-all px-3 py-0 rounded w-full h-9 leading-none align-middle"
                  onChange={handleSearch}
                  
                />

              </div>

          </div>
          

          
          {/*APEAR ONLY IF THE USER ROLE IS SALES ASSOCIATE */}
          {user.role === 'Sales Associate' &&
          
            <div  className="ml-auto flex gap-4">
              
              {/*ADD ITEM BTN*/}
              <button className='border border-[#63FF4F] text-[#63FF4F] font-medium hover:bg-[#63FF4F] hover:text-white px-5 rounded-md transition-all' onClick={() => setAddDelivery(true)} >+ NEW DELIVERY</button>

            </div>

          }
          

        </div>

        <hr className="border-t-2 my-4 w-full border-gray-500"/>


        {/*TABLE */}
        <div className="overflow-x-auto  overflow-y-auto h-[560px] border-b-2 border-gray-500 bg-red rounded-sm hide-scrollbar">
          <table className="w-full divide-y divide-gray-200  text-sm">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white ">
                    ID
                  </th>
                  
                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white ">
                    COURIER NAME
                  </th>

                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white">
                    SALE ID
                  </th>

                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white ">
                    DESTINATION ADDRESS
                  </th>


                  <th className="bg-green-500 px-4 py-2 text-left text-sm font-medium text-white ">
                    DELIVERY DATE
                  </th>
                  <th className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white ">
                    STATUS
                  </th>
                 
    
               
              </tr>
            </thead>

            
            <tbody className="bg-white">

              {!filteredData || filteredData.length === 0 ? 
                (
                  <NoInfoFound col={6}/>
                ) : 

                (
                  filteredData.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-gray-200/70 h-14 ${(idx + 1 ) % 2 === 0 ? "bg-[#F6F6F6]":""}` } onClick={() => {openDetailes(row); setModalType("other")}}>
                      <td className="px-4 py-2 text-left">{row.delivery_id}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap text-left"  >{row.courier_name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-left">{row.sales_information_id}</td>
                      <td className="px-4 py-2 text-left">{row.destination_address}</td>
                      <td className="px-4 py-2 text-left">{row.formated_delivered_date}</td>
                      <td className="px-4 py-2 text-center">
                        <button 
                        className={`${!row.is_delivered ? 'bg-amber-400 text-white' : 'border-2 border-green-700/70 text-green-700/70 font-semibold'} rounded-md px-4 py-2`}
                        onClick={(e) => {
                          if (!row.is_delivered) {
                            e.stopPropagation();
                            setDialogSalesId(row.sales_information_id)
                            setDialog(true); 
                            setDialogMode('edit');
                          }
                        }}
                        
                        >
                            {!row.is_delivered ? 'Delivering...' : 'Delivered'}
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

export default DeliveryMonitoring