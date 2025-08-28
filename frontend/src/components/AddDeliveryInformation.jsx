import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../authentication/Authentication';


function AddDeliveryInformation({ openAddDelivery, onClose, saleHeader, deliveryData, setDeliveryData}) {

    const { user } = useAuth();

    const [courierName, setCourierName] = useState('');
    const [salesId, setSalesId] = useState('');
    const [address, setAddress] = useState('');
    const [deliveredDate, setDeliveredDate] = useState('');
    const [status, setStatus] = useState(false);


    useEffect(() => {
        if (openAddDelivery) {
            setCourierName('');
            setSalesId('');
            setAddress('');
            setDeliveredDate('');
            setStatus(false);
           
        }
    }, [openAddDelivery]);



    async function handleSubmit(e) {
        e.preventDefault();
        const payload = { 
            courierName, 
            salesId: Number(salesId), 
            address, 
            currentBranch: user.branch_id,
            deliveredDate, 
            status 
        };

        
        const response = await axios.post('http://localhost:3000/api/delivery/', payload);
        setDeliveryData((prevData) => [...prevData, response.data]);
        console.log('New Delivery Added', response.data);


        onClose();
    }

    if (!openAddDelivery) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/*OVERLAY */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

            {/*MODAL PANEL */}
            <div
                
                role="dialog"
                aria-modal="true"
                className="relative w-[780px] max-w-[92%] bg-white rounded shadow-lg border border-gray-200 p-8 animate-popup"
                onClick={(e) => e.stopPropagation()}
            >
                <h1 className="text-[30px] font-extrabold tracking-wide leading-none mb-10">DELIVERY DETAILS</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
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
                                    onClick={()=>setStatus(false)}
                                    className={`h-14 text-sm font-semibold tracking-wide flex items-center justify-center transition-colors ${!status ? ' text-amber-500 bg-amber-50' : 'bg-gray-50 text-gray-500 hover:bg-white'}`}
                                >
                                    OUT FOR DELIVERY
                                </button>
                                <button
                                    type="button"
                                    onClick={()=>setStatus(true)}
                                    className={`h-14 text-sm font-semibold tracking-wide flex items-center justify-center transition-colors ${status ? 'bg-green-100 text-green-600' : 'bg-gray-50 text-gray-500 hover:bg-white'}`}
                                >
                                    DELIVERED
                                </button>
                            </div>
                        </div>
                    </div>

                    {/*ADD BUTTON */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-48 h-11 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md text-sm tracking-wide shadow-sm transition-colors disabled:opacity-50"
                            disabled={!courierName || !salesId || !address || !deliveredDate}
                        >
                            CONFIRM DELIVERY
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