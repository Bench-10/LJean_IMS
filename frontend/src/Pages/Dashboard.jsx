import React from 'react';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard.jsx';
import { useAuth } from '../authentication/Authentication';

function Dashboard() {

  const { user } = useAuth();

  const isOwner = user?.role === 'Owner' || user?.role === 'owner' || user?.role === 'ADMIN';
  
  const branchId = isOwner ? undefined : user?.branch_id;

  return (
    <div className='ml-[220px] px-6 py-8 h-full overflow-hidden bg-[#eef2ee] flex flex-col'>
      <AnalyticsDashboard branchId={branchId} canSelectBranch={isOwner} />
    </div>
  )
}

export default Dashboard