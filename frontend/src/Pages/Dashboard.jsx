import React from 'react';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard.jsx';
import { useAuth } from '../authentication/Authentication';
import OwnerAnalytics from './OwnerAnalytics.jsx';

function Dashboard() {
  const { user } = useAuth();


  const isOwner = user?.role === 'Owner';


  if(isOwner) return <OwnerAnalytics />;


  const branchId = user?.branch_id;


  return (
    <div className='px-6 py-4 h-full overflow-hidden bg-[#eef2ee] flex flex-col'>
      <AnalyticsDashboard branchId={branchId} />
    </div>
    
  );

}

export default Dashboard;
