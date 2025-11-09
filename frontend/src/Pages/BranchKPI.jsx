
import React, { useEffect, useState } from 'react';
import { analyticsApi } from '../utils/api.js';
import { useParams, NavLink } from 'react-router-dom';
import { IoArrowBack } from 'react-icons/io5';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard.jsx';

export default function BranchKPI(){
  const { branchId } = useParams();
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{ fetchBranchName(); }, [branchId]);

  async function fetchBranchName(){
    try {

      setLoading(true); setError(null);
  const res = await analyticsApi.get(`/api/analytics/branches`);
      const found = res.data.find(b=> String(b.branch_id) === String(branchId));
      setBranchName(found ? found.branch_name : `Branch ${branchId}`);
    } catch(e){ 

        setError('Failed to load branch info'); 

    } finally { setLoading(false); }

  };

  return (
  <div className='pt-20 lg:pt-8 px-4 lg:px-8 pb-6 h-screen overflow-hidden bg-[#eef2ee] flex flex-col min-h-0'>
      <div className="flex items-center gap-4 flex-wrap mb-4"> 

        <NavLink to="/branches" className="flex gap-2 items-center relative py-1 px-4 border-2 bg-white font-medium rounded-md text-xs text-green-800 border-gray-200 transition-all cursor-pointer hover:bg-green-100">
          <IoArrowBack /> Branches

        </NavLink>

        <h1 className="text-lg font-semibold text-gray-700">{loading ? 'Loading...' : error ? 'Branch' : branchName} Analytics</h1>

      </div>

      <div className='flex-1 min-h-0'>

        <AnalyticsDashboard branchId={Number(branchId)} />

      </div>
    </div>
  );
}

