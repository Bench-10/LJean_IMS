import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAuth } from '../../../authentication/Authentication.jsx';
import { currencyFormat } from '../../../utils/formatCurrency.js';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';
import api from '../../../utils/api.js';
import DropdownCustom from '../../DropdownCustom.jsx';

function BranchTimeline({ Card, categoryFilter, allBranches, branchTimelineRef }) {
  const { user } = useAuth();
  const [branchTimelineData, setBranchTimelineData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [timelineInterval, setTimelineInterval] = useState('monthly');
  
  // ROLE CHECK: ONLY OWNER SHOULD SEE BRANCH TIMELINE
  const isOwner = useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.role) ? user.role : user?.role ? [user.role] : [];
    return roles.includes('Owner');
  }, [user]);

  // FETCH BRANCH TIMELINE DATA WHEN COMPONENT MOUNTS OR PARAMETERS CHANGE
  const fetchBranchTimelineData = useCallback(async (signal) => {
    if (!isOwner || !selectedBranch) {
      setBranchTimelineData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = {
        branch_id: selectedBranch,
        interval: timelineInterval,
        range: '3m'
      };

      if (categoryFilter) {
        params.category_id = categoryFilter;
      }

      const response = await api.get(`/api/analytics/branch-timeline`, {
        params,
        signal
      });

      const timelineData = Array.isArray(response.data) ? response.data : [];
      setBranchTimelineData(timelineData);
    } catch (e) {
      if (e?.code === 'ERR_CANCELED') return;
      console.error('Branch timeline fetch error:', e);
      setError('Failed to load branch timeline data');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, isOwner, selectedBranch, timelineInterval]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBranchTimelineData(controller.signal);
    return () => controller.abort();
  }, [fetchBranchTimelineData]);

  // IF NOT OWNER, RETURN NULL (COMPONENT WON'T RENDER)
  if (!isOwner) return null;

  const selectedBranchName = useMemo(() => {
    if (!selectedBranch) return 'Select Branch';
    const match = allBranches?.find(
      (b) => String(b.branch_id) === String(selectedBranch)
    );
    return match?.branch_name || 'Selected Branch';
  }, [allBranches, selectedBranch]);

  const hasTimelineData = branchTimelineData.length > 0;
  const shouldShowChart = selectedBranch && hasTimelineData && !loading && !error;

  return (
    <>
      {/* BRANCH TIMELINE CHART */}
      <Card title={`BRANCH SALES TIMELINE - ${selectedBranchName.toUpperCase()}`} 
      className="col-span-full h-[calc(100vh-260px)] min-h-[420px]"
      exportRef={branchTimelineRef}>

        <div className="flex flex-col h-full overflow-hidden relative">
          {loading && <ChartLoading message="Loading branch timeline..." />}
          {error && !loading && (
            <ChartNoData
              message={error}
              hint="Please try selecting a different branch or refresh the page."
            />
          )}
          
          {/* CONTROLS */}
          <div data-export-exclude className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 justify-end mb-4">
  {/* BRANCH SELECTOR */}
  <div className="w-full sm:w-[260px]">
    <DropdownCustom
      label="Branch"
      value={selectedBranch}
      labelClassName="text-[11px]"   // slightly smaller label
      onChange={e => setSelectedBranch(e.target.value)}
      options={[{ value: '', label: 'Select Branch' }, ...(Array.isArray(allBranches) ? allBranches.map(b=>({ value: String(b.branch_id), label: b.branch_name })) : [])]}
      variant="simple"
      size="xs"                       // << make this one compact
    />
  </div>

  {/* INTERVAL SELECTOR */}
  <div className="w-full sm:w-[160px]">
    <DropdownCustom
      label="Interval"
      value={timelineInterval}
      labelClassName="text-[11px]"
      onChange={e => setTimelineInterval(e.target.value)}
      options={[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]}
      variant="simple"
      size="xs"                       // << and this one too
    />
  </div>
</div>


          {/* CHART AREA */}
          {!selectedBranch && !loading && !error && (
            <ChartNoData
              message="Please select a branch to view timeline."
              hint="CHOOSE A BRANCH FROM THE DROPDOWN ABOVE."
            />
          )}
          
          {selectedBranch && !loading && !error && !hasTimelineData && (
            <ChartNoData
              message="No sales timeline data for the selected branch and filters."
              hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY FILTER."
            />
          )}

          {shouldShowChart && (
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
