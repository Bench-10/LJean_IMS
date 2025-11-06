import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import api from '../utils/api';

function BranchAnalyticsCards() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(()=>{ loadBranches(); }, []);
    async function loadBranches(){
        try {
            setLoading(true); setError(null);
            const res = await api.get(`/api/analytics/branches`);
            setBranches(res.data);
        } catch(e){ setError('Failed to load branches'); }
        finally { setLoading(false); }
    }

    return (
    <div className='pt-20 lg:pt-8 px-4 lg:px-8 pb-6 h-screen flex flex-col bg-[#eef2ee] min-h-0'>

            <div className="flex flex-wrap items-center mb-4" >
                <NavLink to="/dashboard" className='flex gap-x-2 items-center relative px-3 lg:px-4 py-1 lg:py-2 border-2 bg-white font-medium rounded-md text-green-800 border-gray-200 transition-all cursor-pointer hover:bg-green-100'>
                    <IoArrowBack />
                    <span className="text-sm">Back to Overview</span>
                </NavLink>
            </div>

            <h1 className="text-lg font-semibold text-gray-700 mb-4">Select a Branch</h1>

            {loading && <div className="text-sm text-gray-500">Loading branches...</div>}

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className='grid grid-cols-1 gap-6 mt-2 sm:grid-cols-2 lg:grid-cols-3 overflow-auto pr-1 min-h-0 flex-1'>

                {branches.map(b => (
                    <div key={b.branch_id} className='bg-white p-5 border border-green-600/50 rounded-md flex flex-col'>

                        {/*IMAGE HERE */}
                        <div className='h-28  bg-gray-200 rounded-sm flex items-center justify-center text-green-800 text-sm font-semibold'>
                            {b.branch_name.charAt(0)}
                        </div>


                        {/*BRTANCH INFORMATION*/}
                        <div className='flex flex-col justify-between text-center mt-4 flex-1'>

                            <h2 className='text-green-700 text-md font-bold'>{b.branch_name}</h2>

                            <p className='text-xs'>{b.address}</p>

                            <button onClick={()=>navigate(`/branch-analytics/${b.branch_id}`)} 
                            
                            className='border border-green-700 bg-green-50 hover:bg-green-600 hover:text-white transition-colors py-2 px-5 rounded-md text-sm text-green-800 font-semibold'>View Analytics</button>
                        </div>
                    </div>
                ))}
                {!loading && !error && branches.length === 0 && (
                    <div className='text-sm text-gray-500'>No branches found.</div>
                )}
            </div>
        </div>
    );
}

export default BranchAnalyticsCards;
