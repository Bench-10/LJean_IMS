import React, { useState, useEffect } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../../authentication/Authentication.jsx';
import axios from 'axios';
import { currencyFormat } from '../../../utils/formatCurrency.js';
import dayjs from 'dayjs';

function BranchPerformance({ Card, rangeMode, preset, startDate, endDate, todayISO }) {
  const { user } = useAuth();
  const [branchTotals, setBranchTotals] = useState([]); // [{ branch_id, branch_name, total_amount_due }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [screenDimensions, setScreenDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // ROLE CHECK: ONLY OWNER SHOULD SEE BRANCH PERFORMANCE CHARTS
  const isOwner = user?.role?.some(role => ['Owner'].includes(role));

  // COLORS FOR PIE CHART SEGMENTS
  const PIE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316'];

  // RESPONSIVE SIZING CALCULATIONS
  const calculateResponsiveSizes = () => {
    const { width, height } = screenDimensions;
    
    // BASE SIZES ON SCREEN DIMENSIONS
    const baseRadius = Math.min(width * 0.08, height * 0.12); // RESPONSIVE RADIUS
    const outerRadius = Math.max(60, Math.min(baseRadius, 180)); // MIN 60, MAX 180
    
    // ADJUST FONT SIZES BASED ON SCREEN SIZE
    const legendFontSize = width < 768 ? 10 : width < 1024 ? 11 : 12;
    const tooltipFontSize = width < 768 ? 12 : 14;
    
    // RESPONSIVE POSITIONING
    const centerY = height < 600 ? '40%' : '45%';
    
    return {
      outerRadius,
      legendFontSize,
      tooltipFontSize,
      centerY,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024
    };
  };

  // UPDATE SCREEN DIMENSIONS ON RESIZE
  useEffect(() => {
    const handleResize = () => {
      setScreenDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // HELPER TO RESOLVE DATE RANGE CONSISTENTLY
  const resolveDateRange = () => {
    let start_date = startDate;
    let end_date = endDate;
    if(rangeMode === 'preset') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let s = today;
      if(preset === 'current_day') s = today;
      else if(preset === 'current_week') {
        const dow = today.getDay();
        const offset = (dow === 0 ? -6 : 1 - dow);
        s = new Date(today); s.setDate(s.getDate() + offset);
      } else if(preset === 'current_month') s = new Date(today.getFullYear(), today.getMonth(), 1);
      else if(preset === 'current_year') s = new Date(today.getFullYear(), 0, 1);
      start_date = s.toISOString().slice(0,10);
      end_date = today.toISOString().slice(0,10);
    }
    return { start_date, end_date };
  };

  // FETCH BRANCH TOTALS WHEN COMPONENT MOUNTS OR DATE RANGE CHANGES
  useEffect(() => {
    // ONLY FETCH WHEN OWNER
    if (!isOwner) return;
    
    const fetchBranchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const { start_date, end_date } = resolveDateRange();
        
        // USE EFFICIENT BACKEND ENDPOINT FOR BRANCH SUMMARY
        const branchSummaryRes = await axios.get('http://localhost:3000/api/analytics/branches-summary', { 
          params: { start_date, end_date } 
        });
        const branchData = branchSummaryRes.data || [];
        console.log('📊 Branch performance data received:', branchData);
        setBranchTotals(branchData);
      } catch (e) {
        console.error('Branch performance fetch error:', e);
        setError('Failed to load branch performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchBranchData();
  }, [isOwner, rangeMode, preset, startDate, endDate]);

  // IF NOT OWNER, RETURN NULL (COMPONENT WON'T RENDER)
  if (!isOwner) return null;

  // FILTER OUT BRANCHES WITH ZERO SALES FOR PIE CHART
  const pieChartData = branchTotals.filter(item => item.total_amount_due > 0);
  
  // ENSURE DATA HAS NUMERIC VALUES
  const processedPieData = pieChartData.map(item => ({
    ...item,
    total_amount_due: Number(item.total_amount_due)
  }));

  // GET RESPONSIVE SIZES FOR CURRENT SCREEN
  const responsiveSizes = calculateResponsiveSizes();
  return (
    <>
      {/* BRANCH PERFORMANCE COMPARISON */}
      <Card title={"BRANCH PERFORMANCE COMPARISON"} className="col-span-8 h-[500px]">
        <div className="flex flex-col h-full max-h-full overflow-hidden">
          {loading && <div className="text-sm text-gray-500">Loading branch performance...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && !error && branchTotals.length > 0 && (
            <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="branch-performance">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={branchTotals}
                  margin={{ top: 10, right: 5, left: 5, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="branch_name" 
                    tick={{ fontSize: 10 }} 
                    axisLine={false} 
                    tickLine={false} 
                    interval={0} 
                    textAnchor="end" 
                    height={60}
                    angle={-45}
                  />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [currencyFormat(value), "Total Sales"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar 
                    name="Total Sales" 
                    dataKey="total_amount_due" 
                    fill="#3b82f6" 
                    radius={[4,4,0,0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {!loading && !error && branchTotals.length === 0 && (
            <div className="text-sm text-gray-500 flex items-center justify-center h-full">
              No branch performance data available for the selected range.
            </div>
          )}
        </div>
      </Card>

      {/* PIE CHART: REVENUE DISTRIBUTION BY BRANCH */}
      <Card title={"REVENUE DISTRIBUTION"} className="col-span-4 h-[500px]">
        <div className="flex flex-col h-full max-h-full overflow-hidden">
          {loading && <div className="text-sm text-gray-500">Loading distribution...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          
          {!loading && !error && processedPieData.length > 0 && (
            <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="revenue-distribution">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={processedPieData}
                    dataKey="total_amount_due"
                    nameKey="branch_name"
                    cx="50%"
                    cy={responsiveSizes.centerY}
                    innerRadius={0}
                    outerRadius={responsiveSizes.outerRadius}
                    fill="#8884d8"
                    stroke="#fff"
                    strokeWidth={responsiveSizes.isMobile ? 1 : 2}
                  >
                    {processedPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [currencyFormat(value), name]} 
                    labelFormatter={(label) => `Branch: ${label}`}
                    contentStyle={{ 
                      fontSize: responsiveSizes.tooltipFontSize,
                      padding: responsiveSizes.isMobile ? '8px' : '12px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ 
                      fontSize: responsiveSizes.legendFontSize,
                      paddingTop: responsiveSizes.isMobile ? '10px' : '15px'
                    }}
                    iconSize={responsiveSizes.isMobile ? 12 : 14}
                    layout={responsiveSizes.isMobile ? 'horizontal' : 'horizontal'}
                    align={responsiveSizes.isMobile ? 'center' : 'center'}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          
          {!loading && !error && processedPieData.length === 0 && branchTotals.length === 0 && (
            <div className="text-sm text-gray-500 flex items-center justify-center h-full">
              No revenue distribution data available.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

export default BranchPerformance;