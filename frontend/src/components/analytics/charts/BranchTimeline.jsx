import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAuth } from '../../../authentication/Authentication.jsx';
import { currencyFormat } from '../../../utils/formatCurrency.js';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';
import api from '../../../utils/api.js';

function BranchTimeline({ Card, categoryFilter, allBranches, loadingBranchTimeline, branchTimelineRef }) {
  const { user } = useAuth();
  const [branchTimelineData, setBranchTimelineData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [timelineInterval, setTimelineInterval] = useState('monthly');
  
  // ROLE CHECK: ONLY OWNER SHOULD SEE BRANCH TIMELINE
  const isOwner = user?.role?.some(role => ['Owner'].includes(role));  // DEBUG: Log props to check data flow
  console.log('🔍 BranchTimeline props:', {
    allBranches: allBranches?.length || 0,
    categoryFilter,
    isOwner,
    selectedBranch
  });

  // FETCH BRANCH TIMELINE DATA WHEN COMPONENT MOUNTS OR PARAMETERS CHANGE
  useEffect(() => {
    // ONLY FETCH WHEN OWNER AND BRANCH IS SELECTED
    if (!isOwner || !selectedBranch) {
      setBranchTimelineData([]);
      return;
    }
    
    const fetchBranchTimelineData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = {
          branch_id: selectedBranch,
          interval: timelineInterval
        };

        // ADD CATEGORY FILTER IF SELECTED
        if (categoryFilter) {
          params.category_id = categoryFilter;
        }

        // USE DEFAULT RANGE FOR TIMELINE
        params.range = '3m';
        
        console.log('📊 Fetching branch timeline with params:', params);
        
        const response = await api.get(`/api/analytics/branch-timeline`, { 
          params 
        });
        
        const timelineData = response.data || [];
        console.log('📊 Branch timeline data received:', timelineData);
        setBranchTimelineData(timelineData);
      } catch (e) {
        console.error('Branch timeline fetch error:', e);
        setError('Failed to load branch timeline data');
      } finally {
        setLoading(false);
      }
    };

    fetchBranchTimelineData();
  }, [isOwner, selectedBranch, timelineInterval, categoryFilter]);

  // IF NOT OWNER, RETURN NULL (COMPONENT WON'T RENDER)
  if (!isOwner) return null;

  const selectedBranchName = selectedBranch 
    ? allBranches.find(b => String(b.branch_id) === String(selectedBranch))?.branch_name || 'Selected Branch'
    : 'Select Branch';

  return (
    <>
      {/* BRANCH TIMELINE CHART */}
      <Card title={`BRANCH SALES TIMELINE - ${selectedBranchName.toUpperCase()}`} className="col-span-full h-[220px] md:h-[260px] lg:h-[280px]" exportRef={branchTimelineRef}>
        <div className="flex flex-col h-full max-h-full overflow-hidden relative">
          {(loading || loadingBranchTimeline) && <ChartLoading message="Loading branch timeline..." />}
          
          {/* CONTROLS */}
          <div data-export-exclude className="flex items-center gap-3 justify-end mb-4 flex-wrap">
            {/* BRANCH SELECTOR */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-gray-600 font-semibold">Branch</label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-white min-w-[140px]"
              >
                <option value="">Select Branch</option>
                {allBranches && allBranches.length > 0 ? (
                  allBranches.map(branch => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name}
                    </option>
                  ))
                ) : (
                  <option disabled>Loading branches...</option>
                )}
              </select>
            </div>

            {/* INTERVAL SELECTOR */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-gray-600 font-semibold">Interval</label>
              <select
                value={timelineInterval}
                onChange={e => setTimelineInterval(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {/* CHART AREA */}
          {loading && <div className="text-sm text-gray-500">Loading branch timeline...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          
          {!selectedBranch && !loading && !error && (
            <ChartNoData
              message="Please select a branch to view timeline."
              hint="CHOOSE A BRANCH FROM THE DROPDOWN ABOVE."
            />
          )}
          
          {selectedBranch && !loading && !error && branchTimelineData.length === 0 && (
            <ChartNoData
              message="No sales timeline data for the selected branch and filters."
              hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY FILTER."
            />
          )}

          {selectedBranch && !loading && !error && branchTimelineData.length > 0 && (
            <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="branch-timeline">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={branchTimelineData}
                  margin={{ top: 10, right: 15, left: 0, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="formatted_period" 
                    tick={{ fontSize: 10 }} 
                    axisLine={false} 
                    tickLine={false}
                  />
                  {(() => {
                    const maxSales = branchTimelineData.reduce((m,p) => Math.max(m, Number(p.sales_amount)||0), 0);
                    const maxUnits = branchTimelineData.reduce((m,p) => Math.max(m, Number(p.units_sold)||0), 0);
                    const overallMax = Math.max(maxSales, maxUnits);
                    
                    if (overallMax <= 0) return <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 1]} />;
                    
                    const target = Math.ceil(overallMax * 1.15); 
                    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                    const padded = Math.ceil(target / magnitude) * magnitude;
                    
                    return <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, padded]} />;
                  })()}
                  <Tooltip 
                    labelFormatter={(label) => {
                      // Simple date formatting based on interval
                      if (timelineInterval === 'daily') {
                        return `Date: ${label}`;
                      } else if (timelineInterval === 'weekly') {
                        return `Week of: ${label}`;
                      } else {
                        return `Month: ${label}`;
                      }
                    }}
                    formatter={(value, name) => {
                      if (name === 'Sales Amount') {
                        return [currencyFormat(value), 'Sales Amount (Net Vat)'];
                      } else if (name === 'Units Sold') {
                        return [`${value} units`, 'Units Sold'];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={24} 
                    wrapperStyle={{ fontSize: 10 }}
                    payload={[
                      { value: 'Sales Amount', type: 'rect', color: '#0f766e' },
                      { value: 'Units Sold', type: 'rect', color: '#0891b2' }
                    ]}
                  />
                  
                  <Bar 
                    dataKey="sales_amount" 
                    name="Sales Amount"
                    fill="#0f766e" 
                    radius={[4,4,0,0]}
                  />
                  <Bar 
                    dataKey="units_sold" 
                    name="Units Sold"
                    fill="#0891b2" 
                    radius={[4,4,0,0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

export default BranchTimeline;