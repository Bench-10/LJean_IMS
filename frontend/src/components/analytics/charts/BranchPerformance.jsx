import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend, PieChart, Pie, Cell, LabelList
} from 'recharts';
import { useAuth } from '../../../authentication/Authentication.jsx';
import { currencyFormat } from '../../../utils/formatCurrency.js';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';
import api, { analyticsApi } from '../../../utils/api.js';
import DropdownCustom from '../../DropdownCustom.jsx';

const branchPerformanceCache = new Map();

function BranchPerformance({
  Card,
  categoryFilter,
  startDate,
  endDate,
  branchPerformanceRef,
  revenueDistributionRef,
  productIdFilter,
  setProductIdFilter,
  salesTypeLabel,
  useNetAmount,
  salesModeVersion
}) {
  const { user } = useAuth();
  const [branchTotals, setBranchTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolvedSalesTypeLabel = salesTypeLabel || (useNetAmount ? 'Net Sales' : 'Gross Sales');
  const [screenDimensions, setScreenDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const [productOptions, setProductOptions] = useState([{ value: '', label: 'All Products' }]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState(null);

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
    const isMobile = width < 640;
    const baseRadius = Math.min(width * (isMobile ? 0.16 : 0.05), height * (isMobile ? 0.22 : 0.08));
    const outerRadius = Math.max(isMobile ? 70 : 40, Math.min(baseRadius, isMobile ? 150 : 120));
    const legendFontSize = width < 768 ? 10 : width < 1024 ? 11 : 12;
    const tooltipFontSize = width < 768 ? 12 : 14;
    const centerY = height < 600 ? '40%' : '45%';
    return { outerRadius, legendFontSize, tooltipFontSize, centerY, isMobile: width < 768 };
  }, [screenDimensions]);

  const chartMargins = useMemo(() => {
    const isNarrow = screenDimensions.width < 640;
    return {
      top: 10,
      right: 5,
      left: 5,
      bottom: isNarrow ? 28 : 20
    };
  }, [screenDimensions.width]);

  const xAxisHeight = useMemo(
    () => (screenDimensions.width < 640 ? 36 : 28),
    [screenDimensions.width]
  );

  const showYAxisTicks = screenDimensions.width >= 640;
  const barLabelFontSize = useMemo(
    () => (screenDimensions.width < 640 ? 5 : 6),
    [screenDimensions.width]
  );

  const formatBarLabel = useCallback((value) => {
    const formatted = currencyFormat(value);
    if (screenDimensions.width < 640) {
      return formatted.replace('₱ ', '₱');
    }
    return formatted;
  }, [screenDimensions.width]);

  const productFilterSetter = typeof setProductIdFilter === 'function' ? setProductIdFilter : null;

  const normalizedProductFilter = useMemo(() => {
    if (productIdFilter === null || productIdFilter === undefined) return '';
    const trimmed = String(productIdFilter).trim();
    if (trimmed === '') return '';
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? String(parsed) : '';
  }, [productIdFilter]);

  const selectedProductLabel = useMemo(() => {
    if (!normalizedProductFilter) return '';
    const match = productOptions.find((option) => option.value === normalizedProductFilter);
    if (match?.label) return match.label;
    return `Product #${normalizedProductFilter}`;
  }, [normalizedProductFilter, productOptions]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadProducts() {
      try {
        setProductLoading(true);
        setProductError(null);
        const params = {};
        if (categoryFilter) {
          params.category_id = categoryFilter;
        }
        const requestConfig = { signal: controller.signal };
        if (Object.keys(params).length) {
          requestConfig.params = params;
        }
        const res = await api.get(`/api/items/unique`, requestConfig);
        if (!isMounted) return;
        const uniqueProducts = Array.isArray(res.data) ? res.data : [];
        const mapped = uniqueProducts.map((item) => ({
          value: String(item.product_id),
          label: item.product_name ? `${item.product_name} (#${item.product_id})` : `Product #${item.product_id}`
        }));
        const nextOptions = [{ value: '', label: 'All Products' }, ...mapped];
        setProductOptions(nextOptions);
        if (
          productFilterSetter &&
          normalizedProductFilter &&
          !nextOptions.some((option) => option.value === normalizedProductFilter)
        ) {
          productFilterSetter('');
        }
      } catch (err) {
        if (err?.code === 'ERR_CANCELED') return;
        if (!isMounted) return;
        console.error('Branch performance products fetch error', err);
        setProductError('Unable to load product list');
        setProductOptions((prev) => (Array.isArray(prev) && prev.length ? prev : [{ value: '', label: 'All Products' }]));
      } finally {
        if (isMounted) setProductLoading(false);
      }
    }

    loadProducts();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [categoryFilter, normalizedProductFilter, productFilterSetter]);

  const handleProductChange = useCallback((event) => {
    if (!productFilterSetter) return;
    const nextValue = event?.target?.value ?? '';
    productFilterSetter(nextValue);
  }, [productFilterSetter]);

  const handleClearProduct = useCallback(() => {
    if (!productFilterSetter) return;
    productFilterSetter('');
  }, [productFilterSetter]);

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

  const cacheKey = useMemo(
    () => JSON.stringify({
      start: startDate,
      end: endDate,
      category: categoryFilter || 'all',
      product: normalizedProductFilter || 'all',
      useNetAmount: !!useNetAmount,
      salesModeVersion: salesModeVersion ?? 0
    }),
    [categoryFilter, endDate, normalizedProductFilter, startDate, useNetAmount, salesModeVersion]
  );

  // Fetch branch performance data
  const fetchBranchPerformance = useCallback(async (signal, { silent = false } = {}) => {
    if (!user || !isOwner) {
      setBranchTotals([]);
      setError(null);
      if (!silent) setLoading(false);
      return;
    }

    const cached = branchPerformanceCache.get(cacheKey);
    if (cached) {
      setBranchTotals(cached.data);
      setError(null);
      if (!silent) setLoading(false);
      // For real-time updates, proceed to refresh in background when silent
      if (!silent) return;
    }

    if (!silent) setLoading(true);
    setError(null);

    try {
      const params = { 
        start_date: startDate, 
        end_date: endDate,
        use_net_amount: !!useNetAmount
      };
      if (categoryFilter) {
        params.category_id = categoryFilter;
      }
      if (normalizedProductFilter) {
        params.product_id = normalizedProductFilter;
      }

      const response = await analyticsApi.get(`/api/analytics/branches-summary`, { 
        params, 
        signal 
      });
      
      const data = Array.isArray(response.data) ? response.data : [];
      setBranchTotals(data);
      branchPerformanceCache.set(cacheKey, { data });
    } catch (e) {
      if (e?.code === 'ERR_CANCELED') return;
      console.error('Branch performance fetch error', e);
      setBranchTotals([]);
      setError('Failed to load branch performance data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [cacheKey, categoryFilter, endDate, isOwner, normalizedProductFilter, startDate, useNetAmount, user]);

  // Fetch data when dependencies change
  useEffect(() => {
    if (!user || !isOwner) return;
    const controller = new AbortController();
    fetchBranchPerformance(controller.signal);
    return () => controller.abort();
  }, [fetchBranchPerformance, user, isOwner]);

  // Real-time analytics updates: refresh silently on sale/inventory events
  useEffect(() => {
    if (!user || !isOwner) return undefined;
    const handler = () => {
      const c = new AbortController();
      fetchBranchPerformance(c.signal, { silent: true });
      return () => c.abort();
    };
    const saleListener = () => handler();
    const inventoryListener = () => handler();
    window.addEventListener('analytics-sale-update', saleListener);
    window.addEventListener('analytics-inventory-update', inventoryListener);
    return () => {
      window.removeEventListener('analytics-sale-update', saleListener);
      window.removeEventListener('analytics-inventory-update', inventoryListener);
    };
  }, [fetchBranchPerformance, isOwner, user]);

  const showBarChart = !loading && !error && branchTotals.length > 0 && hasPositiveBarValues;
  const showPieChart = !loading && !error && processedPieData.length > 0;
  if (!isOwner) return null;

  return (
    <>
      {/* BRANCH PERFORMANCE COMPARISON */}
      <Card
        title={`BRANCH SALES PERFORMANCE COMPARISON (${resolvedSalesTypeLabel})`}
        className="col-span-12 lg:col-span-8 h-[320px] sm:h-[260px] lg:h-[280px]"
        exportRef={branchPerformanceRef}
        exportId="branch-performance"
        exportSpans={{ lg: 8 }}
      >
        <div className="flex flex-col h-full max-h-full overflow-visible relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <ChartLoading message="Loading branch performance..." />
            </div>
          )}
          {error && !loading && (
            <ChartNoData message={error} hint="Please try refreshing the analytics page." onRetry={() => fetchBranchPerformance()} />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-2" data-export-exclude>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wide">Product</span>
              <div className="w-[220px] sm:w-64">
                <DropdownCustom
                  value={normalizedProductFilter}
                  onChange={handleProductChange}
                  options={productOptions}
                  variant="default"
                  size="xs"
                  searchable
                  searchPlaceholder="Search products"
                  noResultsMessage="No matching products"
                  autoFocusSearch={!responsiveSizes.isMobile}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {productLoading && (
                <span className="text-[10px] text-gray-400">Loading…</span>
              )}
              {!productLoading && productError && (
                <span className="text-[10px] text-red-500">{productError}</span>
              )}
              {normalizedProductFilter && (
                <button
                  type="button"
                  onClick={handleClearProduct}
                  className="text-[11px] font-semibold text-green-700 hover:text-green-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {showBarChart && (
            <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="branch-performance">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={processedBarData}
                  margin={chartMargins}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />

                  <XAxis
                    dataKey="original_name"  // full names
                    tick={<TwoLineTick />}   // two-line tick
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tickMargin={4}
                    height={xAxisHeight}
                    angle={0}
                  />

                  {(() => {
                    const maxAmount = processedBarData.reduce((m, p) => Math.max(m, Number(p.total_amount_due) || 0), 0);
                    if (maxAmount <= 0) {
                      return (
                        <YAxis
                          domain={[0, 1]}
                          {...(showYAxisTicks
                            ? { tick: { fontSize: 12 }, axisLine: false, tickLine: false }
                            : { hide: true })}
                        />
                      );
                    }
                    const target = Math.ceil(maxAmount * 1.15);
                    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                    const padded = Math.ceil(target / magnitude) * magnitude;
                    return (
                      <YAxis
                        domain={[0, padded]}
                        {...(showYAxisTicks
                          ? { tick: { fontSize: 12 }, axisLine: false, tickLine: false }
                          : { hide: true })}
                      />
                    );
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
                  >
                    <LabelList
                      dataKey="total_amount_due"
                      position="top"
                      formatter={formatBarLabel}
                      style={{ fontSize: barLabelFontSize, fill: '#0f172a', fontWeight: 600 }}
                    />
                  </Bar>
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
        title={(
          <span className="flex flex-wrap items-center gap-2">
            <span>{`REVENUE DISTRIBUTION (${resolvedSalesTypeLabel}) %`}</span>
            {selectedProductLabel && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                {selectedProductLabel}
              </span>
            )}
          </span>
        )}
        className="col-span-12 lg:col-span-4 h-[320px] sm:h-[260px] lg:h-[280px]"
        exportRef={revenueDistributionRef}
        exportId="revenue-distribution"
        exportSpans={{ lg: 4 }}
      >
        <div className="flex flex-col h-full max-h-full overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <ChartLoading message="Loading distribution..." />
            </div>
          )}
          {error && !loading && (
            <ChartNoData message={error} hint="Please try refreshing the analytics page." onRetry={() => fetchBranchPerformance()} />
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
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percentage, index }) => {
                      const RADIAN = Math.PI / 180;
                      // For small slices (< 8%), place label outside with a line
                      if (percentage < 8) {
                        const outerLabelRadius = outerRadius + 18;
                        const x = cx + outerLabelRadius * Math.cos(-midAngle * RADIAN);
                        const y = cy + outerLabelRadius * Math.sin(-midAngle * RADIAN);
                        const textAnchor = x > cx ? 'start' : 'end';
                        return (
                          <text x={x} y={y} fill={PIE_COLORS[index % PIE_COLORS.length]} textAnchor={textAnchor} dominantBaseline="central" style={{ fontSize: 8, fontWeight: 600 }}>
                            {`${percentage}%`}
                          </text>
                        );
                      }
                      // For larger slices, place label inside
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 8, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                          {`${percentage}%`}
                        </text>
                      );
                    }}
                    labelLine={({ cx, cy, midAngle, outerRadius, percentage }) => {
                      if (percentage >= 8) return null;
                      const RADIAN = Math.PI / 180;
                      const startX = cx + outerRadius * Math.cos(-midAngle * RADIAN);
                      const startY = cy + outerRadius * Math.sin(-midAngle * RADIAN);
                      const endX = cx + (outerRadius + 12) * Math.cos(-midAngle * RADIAN);
                      const endY = cy + (outerRadius + 12) * Math.sin(-midAngle * RADIAN);
                      return (
                        <path d={`M${startX},${startY}L${endX},${endY}`} stroke="#94a3b8" strokeWidth={1} fill="none" />
                      );
                    }}
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
