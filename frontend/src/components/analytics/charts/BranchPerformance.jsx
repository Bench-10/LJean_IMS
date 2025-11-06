import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../../authentication/Authentication.jsx';
import { currencyFormat } from '../../../utils/formatCurrency.js';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';

function BranchPerformance({ Card, branchTotals, loading, error, branchPerformanceRef, revenueDistributionRef }) {
  const { user } = useAuth();
  const [screenDimensions, setScreenDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // ROLE CHECK: ONLY OWNER SHOULD SEE BRANCH PERFORMANCE CHARTS
  const isOwner = useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.role) ? user.role : user?.role ? [user.role] : [];
    return roles.includes('Owner');
  }, [user]);

  // COLORS FOR PIE CHART SEGMENTS
  const PIE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316'];

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

  
  const responsiveSizes = useMemo(() => {
    const { width, height } = screenDimensions;
    const baseRadius = Math.min(width * 0.05, height * 0.08);
    const outerRadius = Math.max(40, Math.min(baseRadius, 120));
    const legendFontSize = width < 768 ? 10 : width < 1024 ? 11 : 12;
    const tooltipFontSize = width < 768 ? 12 : 14;
    const centerY = height < 600 ? '40%' : '45%';

    return {
      outerRadius,
      legendFontSize,
      tooltipFontSize,
      centerY,
      isMobile: width < 768
    };
  }, [screenDimensions]);

  const pieChartData = useMemo(
    () => branchTotals.filter(item => Number(item.total_amount_due) > 0),
    [branchTotals]
  );

  const totalRevenue = useMemo(
    () => pieChartData.reduce((sum, item) => sum + Number(item.total_amount_due), 0),
    [pieChartData]
  );

  const processedPieData = useMemo(
    () => pieChartData.map(item => {
      const amount = Number(item.total_amount_due);
      const percentage = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
      return {
        ...item,
        total_amount_due: amount,
        percentage: Number(percentage.toFixed(1))
      };
    }),
    [pieChartData, totalRevenue]
  );

  const hasPositiveBarValues = useMemo(
    () => branchTotals.some(item => Number(item.total_amount_due) > 0),
    [branchTotals]
  );

  const truncateBranchName = useCallback((name, maxLength = 8) => {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    return `${name.substring(0, maxLength)}...`;
  }, []);

  const processedBarData = useMemo(
    () => branchTotals.map(item => ({
      ...item,
      display_name: truncateBranchName(item.branch_name, 8),
      original_name: item.branch_name
    })),
    [branchTotals, truncateBranchName]
  );

  const showBarChart = !loading && !error && branchTotals.length > 0 && hasPositiveBarValues;
  const showPieChart = !loading && !error && processedPieData.length > 0;
  if (!isOwner) return null;

  return (
    <>
      {/* BRANCH PERFORMANCE COMPARISON */}
      <Card
        title={"BRANCH SALES PERFORMANCE COMPARISON"}
        className="col-span-12 lg:col-span-8 h-[220px] md:h-[260px] lg:h-[280px]"
        exportRef={branchPerformanceRef}
      >
        <div className="flex flex-col h-full max-h-full overflow-hidden relative">
          {loading && <ChartLoading message="Loading branch performance..." />}
          {error && !loading && (
            <ChartNoData
              message={error}
              hint="Please try refreshing the analytics page."
            />
          )}
          
          {showBarChart && (
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
                    angle={0}
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
          {!loading && !error && !showBarChart && (
            <ChartNoData
              message="No branch performance data for the selected range."
              hint="TRY EXPANDING THE DATE RANGE."
            />
          )}
        </div>
      </Card>

      {/* PIE CHART: REVENUE DISTRIBUTION BY BRANCH (PERCENTAGE) */}
      <Card
        title={"REVENUE DISTRIBUTION (%)"}
        className="col-span-12 lg:col-span-4 h-[220px] md:h-[260px] lg:h-[280px]"
        exportRef={revenueDistributionRef}
      >
        <div className="flex flex-col h-full max-h-full overflow-hidden relative">
          {loading && <ChartLoading message="Loading distribution..." />}
          {error && !loading && (
            <ChartNoData
              message={error}
              hint="Please try refreshing the analytics page."
            />
          )}
          
          {showPieChart && (
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
          
          {!loading && !error && !showPieChart && (
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
