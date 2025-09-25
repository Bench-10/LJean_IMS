import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api.js';
import { useAuth } from '../authentication/Authentication';
import ConfirmationDialog from './dialogs/ConfirmationDialog.jsx';


function AddDeliveryInformation({ openAddDelivery, onClose, saleHeader, deliveryData, getDeliveries, mode, deliveryEditData}) {

    const { user } = useAuth();

    //FOR DIALOG
    const [openDialog, setDialog] = useState(false);
    const message = mode ==='edit' ? 'Are you sure you want to edit this ': 'Are you sure you want to add this ?';


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

        const payload = { 
            courierName, 
            salesId: Number(salesId), 
            address, 
            currentBranch: user.branch_id,
            deliveredDate, 
            status 
        };

        if (mode === 'add'){
            const response = await api.post(`/api/delivery/`, payload);
            getDeliveries()
            console.log('New Delivery Added', response.data);
        } else {

            const delivery = await api.put(`/api/delivery/${deliveryEditData.sales_information_id}`, payload);
        
            getDeliveries((prevData) => 
                prevData.map((item) => (item.sales_information_id === Number(id) ? {...item, is_delivered: delivery.data} : item))
            );
            
        };
        

        onClose();
    }


    if (!openAddDelivery) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">


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

                                    {saleHeader.filter(row => !deliveryData.some(
                                        delivery => String(delivery.sales_information_id) === String(row.sales_information_id)
                                        )).map((row, index) => (


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
                                <button
                                    type="button"
                                    onClick={()=>setStatus({is_delivered: false, pending: true})}
                                    className={`h-14 text-sm font-semibold tracking-wide flex items-center justify-center transition-colors ${status.pending ? ' text-amber-500 bg-amber-50' : 'bg-gray-50 text-gray-500 hover:bg-white'}`}
                                >
                                    OUT FOR DELIVERY
                                </button>
                                <button
                                    type="button"
                                    onClick={()=>setStatus({is_delivered: true, pending: false})}
                                    className={`h-14 text-sm font-semibold tracking-wide flex items-center justify-center transition-colors ${status.is_delivered && !status.pending ? 'bg-green-100 text-green-600' : 'bg-gray-50 text-gray-500 hover:bg-white'}`}
                                >
                                    DELIVERED
                                </button>

                                 <button
                                    type="button"
                                    onClick={()=>setStatus({is_delivered: false, pending: false})}
                                    className={`h-14 text-sm font-semibold tracking-wide flex items-center justify-center transition-colors ${!status.is_delivered && !status.pending ? 'bg-red-100 text-red-600' : 'bg-gray-50 text-gray-500 hover:bg-white'}`}
                                >
                                    UNDELIVERED
                                </button>
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