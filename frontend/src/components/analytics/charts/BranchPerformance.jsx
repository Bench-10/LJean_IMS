import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../../../authentication/Authentication.jsx';
import { currencyFormat } from '../../../utils/formatCurrency.js';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';

function BranchPerformance({
  Card,
  branchTotals,
  loading,
  error,
  branchPerformanceRef,
  revenueDistributionRef
}) {
  const { user } = useAuth();
  const [screenDimensions, setScreenDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Owner-only
  const isOwner = useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.role) ? user.role : user?.role ? [user.role] : [];
    return roles.includes('Owner');
  }, [user]);

  // Colors for pie
  const PIE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316'];

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      setScreenDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive sizes for pie/legend/tooltip
  const responsiveSizes = useMemo(() => {
    const { width, height } = screenDimensions;
    const baseRadius = Math.min(width * 0.05, height * 0.08);
    const outerRadius = Math.max(40, Math.min(baseRadius, 120));
    const legendFontSize = width < 768 ? 10 : width < 1024 ? 11 : 12;
    const tooltipFontSize = width < 768 ? 12 : 14;
    const centerY = height < 600 ? '40%' : '45%';
    return { outerRadius, legendFontSize, tooltipFontSize, centerY, isMobile: width < 768 };
  }, [screenDimensions]);

  // Pie data
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
      return { ...item, total_amount_due: amount, percentage: Number(percentage.toFixed(1)) };
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

  // Normalize numeric values; keep both display_name (elsewhere) and original_name (axis)
  const processedBarData = useMemo(
    () => branchTotals.map(item => {
      const raw = item.total_amount_due ?? item.total_amount ?? item.total ?? 0;
      const val = Number(raw);
      return {
        ...item,
        total_amount_due: Number.isFinite(val) ? val : 0,
        display_name: truncateBranchName(item.branch_name, 8),
        original_name: item.branch_name
      };
    }),
    [branchTotals, truncateBranchName]
  );

  // Two-line tick helpers (Option A: straight labels + auto-skip)
  const maxCharsPerLine = useMemo(
    () => (screenDimensions.width < 640 ? 10 : 14),
    [screenDimensions.width]
  );

  const splitTwoLines = useCallback((text) => {
    const words = String(text ?? "").split(" ");
    let line1 = "";
    let line2 = "";
    for (const w of words) {
      const test = line1 ? `${line1} ${w}` : w;
      if (test.length <= maxCharsPerLine) line1 = test;
      else line2 = line2 ? `${line2} ${w}` : w;
    }
    if (line2.length > maxCharsPerLine) line2 = line2.slice(0, maxCharsPerLine - 1) + "…";
    return [line1, line2];
  }, [maxCharsPerLine]);

  const TwoLineTick = useCallback(({ x, y, payload }) => {
    const [l1, l2] = splitTwoLines(payload.value);
    const lh = 12;
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor="middle" fontSize={10} fill="#374151">
          <tspan x="0" dy="0">{l1}</tspan>
          {l2 && <tspan x="0" dy={lh}>{l2}</tspan>}
        </text>
      </g>
    );
  }, [splitTwoLines]);

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
            <ChartNoData message={error} hint="Please try refreshing the analytics page." />
          )}

          {showBarChart && (
            <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="branch-performance">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={processedBarData}
                  margin={{ top: 10, right: 5, left: 5, bottom: 40 }} // extra room for 2nd line
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />

                  <XAxis
                    dataKey="original_name"  // full names
                    tick={<TwoLineTick />}   // two-line tick
                    axisLine={false}
                    tickLine={false}
                    interval={0}       // auto-skip when crowded CHANGE THIS INSTEAD OF "preserveStartEnd"   
                    tickMargin={8}
                    height={screenDimensions.width < 640 ? 44 : 36}
                    angle={0}
                  />

                  {(() => {
                    const maxAmount = processedBarData.reduce((m, p) => Math.max(m, Number(p.total_amount_due) || 0), 0);
                    if (maxAmount <= 0) {
                      return <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 1]} />;
                    }
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
                    radius={[4, 4, 0, 0]}
                    minPointSize={2}      // ensure tiny values still show
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
            <ChartNoData message={error} hint="Please try refreshing the analytics page." />
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
                    layout="horizontal"
                    align="center"
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
