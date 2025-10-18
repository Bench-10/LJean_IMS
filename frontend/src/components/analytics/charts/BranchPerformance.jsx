import React, { useState, useEffect } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../../authentication/Authentication.jsx';
import { currencyFormat } from '../../../utils/formatCurrency.js';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';
import api from '../../../utils/api.js';

function BranchPerformance({ Card, rangeMode, preset, startDate, endDate, categoryFilter, loadingBranchPerformance, branchPerformanceRef }) {
  const { user } = useAuth();
  const [branchTotals, setBranchTotals] = useState([]); 
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
    
    // BASE SIZES ON SCREEN DIMENSIONS - REDUCED FOR SMALLER PIE CHART
    const baseRadius = Math.min(width * 0.05, height * 0.08);
    const outerRadius = Math.max(40, Math.min(baseRadius, 120)); 
    
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

  
  const resolveDateRange = () => {
    const start_date = startDate;
    const end_date = endDate;
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
        
        const params = { start_date, end_date };
        
        // ADD CATEGORY FILTER IF SELECTED
        if (categoryFilter) {
          params.category_id = categoryFilter;
        }
        
        console.log('📊 Fetching branch performance with params:', params);
        
        // USE EFFICIENT BACKEND ENDPOINT FOR BRANCH SUMMARY
        const branchSummaryRes = await api.get(`/api/analytics/branches-summary`, { 
          params
        });
        const branchData = branchSummaryRes.data || [];
        
        setBranchTotals(branchData);
      } catch (e) {
        console.error('Branch performance fetch error:', e);
        setError('Failed to load branch performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchBranchData();
  }, [isOwner, rangeMode, preset, startDate, endDate, categoryFilter]);

  // IF NOT OWNER, RETURN NULL (COMPONENT WON'T RENDER)
  if (!isOwner) return null;

  // FILTER OUT BRANCHES WITH ZERO SALES FOR PIE CHART
  const pieChartData = branchTotals.filter(item => item.total_amount_due > 0);
  
  // CALCULATE TOTAL REVENUE FOR PERCENTAGE CALCULATION
  const totalRevenue = pieChartData.reduce((sum, item) => sum + Number(item.total_amount_due), 0);
  
  // ENSURE DATA HAS NUMERIC VALUES AND ADD PERCENTAGE
  const processedPieData = pieChartData.map(item => {
    const amount = Number(item.total_amount_due);
    const percentage = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
    
    return {
      ...item,
      total_amount_due: amount,
      percentage: Number(percentage.toFixed(1))
    };
  });

  // CHECK IF ANY BRANCH HAS A POSITIVE TOTAL FOR BAR CHART
  const hasPositiveBarValues = branchTotals.some(item => Number(item.total_amount_due) > 0);

  // TRUNCATE BRANCH NAMES FOR DISPLAY
  const truncateBranchName = (name, maxLength = 8) => {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  // PROCESS DATA WITH TRUNCATED NAMES FOR BAR CHART
  const processedBarData = branchTotals.map(item => ({
    ...item,
    display_name: truncateBranchName(item.branch_name, 8),
    original_name: item.branch_name
  }));

  // GET RESPONSIVE SIZES FOR CURRENT SCREEN
  const responsiveSizes = calculateResponsiveSizes();
  return (
    <>
      {/* BRANCH PERFORMANCE COMPARISON */}
      <Card title={"BRANCH SALES PERFORMANCE COMPARISON"} className="col-span-12 lg:col-span-8 h-[220px] md:h-[260px] lg:h-[280px]" exportRef={branchPerformanceRef}>
        <div className="flex flex-col h-full max-h-full overflow-hidden relative">
          {(loading || loadingBranchPerformance) && <ChartLoading message="Loading branch performance..." />}
          
          {!loading && !loadingBranchPerformance && !error && branchTotals.length > 0 && hasPositiveBarValues && (
            <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="branch-performance">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={processedBarData}
                  margin={{ top: 10, right: 5, left: 5, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="display_name" 
                    tick={{ fontSize: 10 }} 
                    axisLine={false} 
                    tickLine={false} 
                    interval={0} 
                    textAnchor="end" 
                    height={60}
                    angle={-45}
                  />
                  {(() => {
                    const maxAmount = processedBarData.reduce((m,p) => Math.max(m, Number(p.total_amount_due)||0), 0);
                    
                    if (maxAmount <= 0) return <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 1]} />;
                    
                    const target = Math.ceil(maxAmount * 1.15); 
                    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                    const padded = Math.ceil(target / magnitude) * magnitude;
                    
                    return <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, padded]} />;
                  })()}
                  <Tooltip 
                    formatter={(value) => [currencyFormat(value), "Total Sales"]}
                    labelFormatter={(label, payload) => {
                      const item = payload && payload[0] && payload[0].payload;
                      return item ? `Branch: ${item.original_name}` : `Branch: ${label}`;
                    }}
                  />
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
          {!loading && (!error || error) && (branchTotals.length === 0 || !hasPositiveBarValues) && (
            <ChartNoData
              message="No branch performance data for the selected range."
              hint="TRY EXPANDING THE DATE RANGE."
            />
          )}
        </div>
      </Card>

      {/* PIE CHART: REVENUE DISTRIBUTION BY BRANCH (PERCENTAGE) */}
      <Card title={"REVENUE DISTRIBUTION (%)"} className="col-span-12 lg:col-span-4 h-[220px] md:h-[260px] lg:h-[280px]">
        <div className="flex flex-col h-full max-h-full overflow-hidden relative">
          {(loading || loadingBranchPerformance) && <ChartLoading message="Loading distribution..." />}
          
          {!loading && !loadingBranchPerformance && !error && processedPieData.length > 0 && (
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
                    formatter={(value, name, props) => [
                      `${props.payload.percentage}% (${currencyFormat(value)}) `,
                      name
                    ]} 
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
          
          {!loading && (!error || error) && processedPieData.length === 0 && (
            <ChartNoData
              message="No revenue distribution data available."
              hint="TRY A DIFFERENT DATE RANGE."
            />
          )}
        </div>
      </Card>
    </>
  );
}

export default BranchPerformance;