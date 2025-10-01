import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api.js';
import { useAuth } from '../authentication/Authentication';
import ConfirmationDialog from './dialogs/ConfirmationDialog.jsx';
import FormLoading from './common/FormLoading';


function AddDeliveryInformation({ openAddDelivery, onClose, saleHeader, deliveryData, getDeliveries, fetchProductsData, mode, deliveryEditData}) {

    const { user } = useAuth();

    //FOR DIALOG
    const [openDialog, setDialog] = useState(false);
    const message = mode ==='edit' ? 'Are you sure you want to edit this ': 'Are you sure you want to add this ?';
    const [loading, setLoading] = useState(false);


    const [courierName, setCourierName] = useState('');
    const [salesId, setSalesId] = useState('');
    const [address, setAddress] = useState('');
    const [deliveredDate, setDeliveredDate] = useState('');
    const [status, setStatus] = useState({is_delivered: false, pending: true});

    useEffect(() => {
        if (openAddDelivery) {
            if(mode === 'edit' && deliveryEditData){
                setCourierName(deliveryEditData.courier_name);
                setSalesId(deliveryEditData.sales_information_id);
                setAddress(deliveryEditData.destination_address);
                setDeliveredDate(deliveryEditData.delivered_date);
                setStatus({is_delivered: deliveryEditData.is_delivered, pending: deliveryEditData.is_pending });
            } else {
                setCourierName('');
                setSalesId('');
                setAddress('');
                setDeliveredDate('');
                setStatus({is_delivered: false, pending: true});
            }
           

           
        }
    }, [openAddDelivery]);



    async function handleSubmit(mode) {
        
        try {
            setLoading(true);

            const payload = { 
                courierName, 
                salesId: Number(salesId), 
                address, 
                currentBranch: user.branch_id,
                deliveredDate, 
                status,
                userID: user.user_id,
                userFullName: user.full_name
            };

            if (mode === 'add'){
                const response = await api.post(`/api/delivery/`, payload);
                getDeliveries((prevData) => [...prevData, response.data])
                console.log('New Delivery Added', response.data);
            } else {
                // DELIVERY STATUS UPDATE - MAY AFFECT INVENTORY
                const delivery = await api.put(`/api/delivery/${deliveryEditData.sales_information_id}`, payload);
                
                getDeliveries((prevData) => 
                    prevData.map((item) => (item.sales_information_id === Number(id) ? {...item, is_delivered: delivery.data} : item))
                );

                // REFRESH INVENTORY DATA FOR THE USER WHO MADE THE CHANGE
                if (fetchProductsData) {
                    await fetchProductsData();
                }
                
                console.log('Delivery Updated', delivery.data);
                
            };
            
            onClose();
        } catch (error) {
            console.error('Error submitting delivery:', error);
        } finally {
            setLoading(false);
        }
    }


    if (!openAddDelivery) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">

            {loading && (
                <FormLoading message={mode === 'edit' ? 'Updating delivery...' : 'Adding delivery...'} />
            )}

            {openDialog && 
            
                <ConfirmationDialog
                mode={mode}
                message={message}
                submitFunction={() => {handleSubmit(mode)}}
                onClose={() => {setDialog(false);}}
    
                />
            
            }


            {/*OVERLAY */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

            {/*MODAL PANEL */}  
            <div
                
                role="dialog"
                aria-modal="true"
                className="relative w-[780px] max-w-[92%] bg-white rounded shadow-lg border border-gray-200 p-8 animate-popup"
                onClick={(e) => e.stopPropagation()}
            >
                <h1 className="text-[30px] font-extrabold tracking-wide leading-none mb-10">
                   {mode === 'edit' ? 'EDIT DELIVERY DETAILS': 'DELIVERY DETAILS'}
                </h1>

                <form onSubmit={(e) => {e.preventDefault(); setDialog(true);}} className="space-y-6">
                    {/*COURIER NAME AND SALE ID */}
                    <div className="flex flex-col sm:flex-row gap-5">
                        <input
                            type="text"
                            placeholder="Courier Name"
                            value={courierName}
                            onChange={(e)=> {setCourierName(e.target.value);}}
                            className="flex-1 h-11 border border-gray-400 rounded px-4 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-300"
                            required
                        />

                        {mode === 'edit' ? 
                            (
                                <input 
                                    value={salesId}
                                    className="w-full sm:w-56 h-11 border border-gray-400 rounded px-4 text-sm placeholder-gray-500 "
                                    readOnly
                                />
                                    
                            ):

                            (
                                <select 
                                    name="" 
                                    id=""
                                    value={salesId}
                                    onChange={e => {
                                        setSalesId(e.target.value);
                                        const corresAddress = saleHeader.find(
                                            row => String(row.sales_information_id) === e.target.value
                                        );
                                        setAddress(corresAddress ? corresAddress.address : '');
                                    }}
                                    className="w-full sm:w-56 h-11 border border-gray-400 rounded px-4 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-300"
                                    required
                                >

                                    <option value="">Select sale id</option>

                                    {saleHeader.filter(row => 
                                        row.is_for_delivery && 
                                        !deliveryData.some(delivery => String(delivery.sales_information_id) === String(row.sales_information_id))
                                    ).map((row, index) => (

                                        <option key={index} value={row.sales_information_id}>{row.sales_information_id}</option>
                                    ))}
                                    
                                


                                </select>
                            )

                        }
                        
                        
                    </div>

                    {/*ADDRESS */}
                        <input
                            type="text"
                            placeholder="Destination Address"
                            value={address}
                            className="w-full h-11 border border-gray-400 rounded px-4 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-300"
                            readOnly

                        />

                    {/*DATE AND STATUS */}
                    <div className="flex flex-col sm:flex-row gap-10 justify-between items-start">
                        <div className='flex items-center w-full'>
                            <h1 className='text-sm font-medium mr-4 whitespace-nowrap'>Delivery Date: </h1>


                            <input
                                type="date"
                                placeholder="Delivered Date"
                                value={deliveredDate}
                                onChange={(e)=>setDeliveredDate(e.target.value)}
                                className="h-11 border border-gray-400 w-full rounded px-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                            />

                        </div>
                        
                        <div className="flex items-start gap-5 w-full">
                            <span className="text-sm font-medium pt-2 whitespace-nowrap">Status :</span>
                            <div className="flex flex-col w-full border border-gray-800 rounded-md overflow-hidden divide-y divide-gray-200 ">
                                
                                <select 
                                 name="" 
                                 id=""
                                  className="h-11 border border-gray-400 w-full rounded px-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                                 value={status.pending ? "out" : (status.is_delivered ? "delivered" : "undelivered")}
                                 onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'out') setStatus({is_delivered: false, pending: true})
                                    if (val === 'delivered') setStatus({is_delivered: true, pending: false})
                                    if (val === 'undelivered') setStatus({is_delivered: false, pending: false})
                                 }}
                                 
                                 >
                                    <option value="out" style={{ color: 'orange', backgroundColor: '#FFF7E0' }}>OUT FOR DELIVERY</option>

                                    {mode === 'edit' &&
                                        <option value="delivered" style={{ color: 'green', backgroundColor: '#E6FFED' }}>DELIVERED</option>
                                    }
                                    
                                    {mode === 'edit' &&

                                        <option value="undelivered" style={{ color: 'red', backgroundColor: '#FFE6E6' }}>UNDELIVERED</option>
                                    }


                                </select>
                            </div>
                        </div>
                    </div>

                    {/*ADD BUTTON */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            className={`w-48 h-11 ${mode === 'edit' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white font-semibold rounded-md text-sm tracking-wide shadow-sm transition-colors disabled:opacity-50`}
                            disabled={!courierName || !salesId || !address || !deliveredDate}
                        >
                            {mode === 'edit' ? 'CONFIRM CHANGES':'CONFIRM DELIVERY'}
                        </button>
                    </div>
                </form>

                {/*CLOSE BUTTON*/}
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-3 right-3 text-gray-400 "
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

export default AddDeliveryInformation;