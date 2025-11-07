import React, { useEffect, useState, useMemo } from 'react';
import { currencyFormat } from '../../../utils/formatCurrency';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Area, Legend, Cell, ReferenceLine, ComposedChart
} from 'recharts';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';
import RestockSuggestionsDialog from '../../dialogs/RestockSuggestionsDialog.jsx';
import { FaLightbulb } from 'react-icons/fa';

import DropdownCustom from '../../../components/DropdownCustom';

// For Y-axis ticks (compact ₱60M, ₱1.2B, etc.)
const pesoAxis = (v) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(v) || 0);

/** Compact tooltip that wraps long product names so it doesn't cover the chart */
const TopBarTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload || {};

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '8px 10px',
        maxWidth: 260,
        boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
        pointerEvents: 'none',
        lineHeight: 1.25,
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
        {p.product_name ?? ''}
      </div>
      <div style={{ fontSize: 12, color: '#475569' }}>
        Sales Amount: <strong>{currencyFormat(p?.sales_amount || 0)}</strong>
      </div>
    </div>
  );
};

function TopProducts({
  topProducts, salesPerformance, formatPeriod, restockTrends, Card, categoryName,
  salesInterval, setSalesInterval, restockInterval, setRestockInterval,
  setProductIdFilter, productIdFilter, loadingSalesPerformance, loadingTopProducts,
  loadingRestockSuggestions, restockSuggestions, dateRangeDisplay, topProductsRef, salesChartRef
}) {
  const [showRestockDialog, setShowRestockDialog] = useState(false);

  // NEW (debug heights)
  useEffect(() => {
    const containers = document.querySelectorAll('[data-chart-container]');
    containers.forEach((container, index) => {
      const rect = container.getBoundingClientRect();
      // eslint-disable-next-line no-console
      console.log(`Container ${index}:`, {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0
      });
    });
  }, []);

  // SET FILTER BY PRODUCT ID
  const handleClick = (data) => {
    setProductIdFilter(data.product_id);
  };

  // CLEAR PRODUCT FILTER
  const clearProductFilter = () => {
    setProductIdFilter('');
  };

  // GET SELECTED PRODUCT NAME
  const selectedProductName = productIdFilter
    ? topProducts?.find(p => p.product_id === parseInt(productIdFilter))?.product_name
    : null;

  const VISIBLE_ROWS = 7;
  const BAR_SIZE = 30;
  const ROW_GAP = 44;
  const MARGIN_TOP = 10;
  const MARGIN_BOTTOM = 10;

  const itemsCount = Array.isArray(topProducts) ? topProducts.length : 0;

  const visibleHeight = (VISIBLE_ROWS * BAR_SIZE) + ((VISIBLE_ROWS - 1) * ROW_GAP) + MARGIN_TOP + MARGIN_BOTTOM;
  const totalHeight = Math.max(
    (itemsCount * BAR_SIZE) + (Math.max(itemsCount - 1, 0) * ROW_GAP) + MARGIN_TOP + MARGIN_BOTTOM,
    100
  );

  const normalizedPerformance = Array.isArray(salesPerformance)
    ? {
      history: salesPerformance,
      forecast: [],
      series: salesPerformance.map(item => ({ ...item, is_forecast: false }))
    }
    : (salesPerformance ?? { history: [], forecast: [], series: [] });

  const combinedSeries = Array.isArray(normalizedPerformance.series) && normalizedPerformance.series.length
    ? normalizedPerformance.series
    : (Array.isArray(normalizedPerformance.history)
      ? normalizedPerformance.history.map(item => ({ ...item, is_forecast: false }))
      : []);

  const actualSeries = combinedSeries
    .filter(item => item && item.is_forecast !== true)
    .map(item => ({
      ...item,
      sales_amount: Number(item.sales_amount ?? item.amount ?? 0),
      units_sold: Number(item.units_sold ?? item.value ?? 0)
    }));

  const forecastSeries = combinedSeries
    .filter(item => item && item.is_forecast === true)
    .map(item => ({
      ...item,
      sales_amount: Number(item.sales_amount ?? item.amount ?? 0),
      units_sold: Number(item.units_sold ?? item.value ?? item.forecast ?? 0)
    }));

  const hasActualData = actualSeries.length > 0;
  const hasForecastData = forecastSeries.length > 0;

  // NEW — historical limit per granularity
  const historicalLimits = {
    daily: 15,
    weekly: 8,
    monthly: 6,
    yearly: 6
  };
  const historicalLimit = historicalLimits[salesInterval] ?? null;

  const displayActualSeries = useMemo(() => {
    if (!historicalLimit || actualSeries.length <= historicalLimit) return actualSeries;
    return actualSeries.slice(-historicalLimit);
  }, [actualSeries, historicalLimit]);

  const displayCombinedSeries = useMemo(() => {
    if (!historicalLimit || actualSeries.length <= historicalLimit) return combinedSeries;
    const allowedPeriods = new Set(displayActualSeries.map(item => item.period));
    return combinedSeries.filter(item => item.is_forecast === true || allowedPeriods.has(item.period));
  }, [combinedSeries, displayActualSeries, actualSeries.length, historicalLimit]);

  const displayForecastSeries = useMemo(() => {
    if (!historicalLimit || actualSeries.length <= historicalLimit) return forecastSeries;
    return displayCombinedSeries.filter(item => item && item.is_forecast === true);
  }, [displayCombinedSeries, forecastSeries, historicalLimit, actualSeries.length]);

  const lastActualPeriod = hasActualData ? actualSeries[actualSeries.length - 1]?.period : null;

  const mapForecastSeriesToChart = (series) => series.map(item => {
    const period = item?.period ?? '';
    const isForecast = item && item.is_forecast === true;
    const actualUnits = !isForecast ? Number(item?.units_sold ?? item?.value ?? 0) : null;
    const isLastActualPoint = !isForecast && hasForecastData && period === lastActualPeriod;

    const rawForecastUnits = Number(item?.units_sold ?? item?.value ?? item?.forecast ?? 0);
    const forecastUnits = isForecast
      ? rawForecastUnits
      : (isLastActualPoint ? Number(item?.units_sold ?? item?.value ?? 0) : null);

    const forecastLower = isForecast && item?.forecast_lower != null ? Number(item.forecast_lower) : null;
    const forecastUpper = isForecast && item?.forecast_upper != null ? Number(item.forecast_upper) : null;

    return {
      period,
      actual_units: actualUnits,
      forecast_units: forecastUnits,
      forecast_lower: isForecast ? forecastLower : null,
      forecast_upper: isForecast ? forecastUpper : null,
      confidence_base: isForecast && forecastLower != null ? forecastLower : null,
      confidence_span: isForecast && forecastLower != null && forecastUpper != null
        ? Math.max(forecastUpper - forecastLower, 0)
        : null
    };
  });

  // NEW
  const forecastChartData = mapForecastSeriesToChart(combinedSeries);
  const chartForecastData = mapForecastSeriesToChart(displayCombinedSeries);



  return (
    <>
      {/* TOP PRODUCTS */}
      <Card
        title={selectedProductName ? `${categoryName} - ${selectedProductName}` : categoryName}
        className="relative col-span-12 lg:col-span-4 h-[360px] md:h-[420px] lg:h-[480px] xl:h-[560px]"
        exportRef={topProductsRef}
      >
        <div className="flex flex-col h-full">
          {loadingTopProducts && <ChartLoading message="Loading top products..." />}

          {selectedProductName && (
            <div data-export-exclude className="absolute top-2 right-3 mb-2">
              <button
                onClick={clearProductFilter}
                className="text-xs text-red-600 hover:text-red-800 underline"
              >
                Clear Product Filter
              </button>
            </div>
          )}

          <div
            className="overflow-y-auto scrollbar-thin [scrollbar-color:transparent_transparent] [scrollbar-width:thin]"
            data-chart-container="top-products"
            style={{ height: visibleHeight, scrollbarColor: 'transparent transparent', scrollbarWidth: 'thin' }}
          >
            {(!topProducts || topProducts.length === 0) ? (
              <ChartNoData message="No top products for the selected filters." />
            ) : (
              <ResponsiveContainer width="100%" height={totalHeight}>
                <BarChart
                  data={topProducts}
                  margin={{ top: MARGIN_TOP, right: 15, left: 15, bottom: MARGIN_BOTTOM }}
                  layout="vertical"
                  barCategoryGap={itemsCount === 1 ? 20 : ROW_GAP}
                  barGap={0}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  {(() => {
                    const max = topProducts.reduce((m, p) => Math.max(m, Number(p.sales_amount) || 0), 0);
                    const padded = max === 0 ? 1 : Math.ceil((max * 1.1) / 100) * 100;
                    return (
                      <XAxis
                        type="number"
                        domain={[0, padded]}
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                    );
                  })()}

                  <YAxis
                    dataKey="product_name"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={90}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tickMargin={4}
                  />

                  {/* Compact, wrapping tooltip */}
                  <Tooltip
                    content={<TopBarTooltip />}
                    wrapperStyle={{ outline: 'none', zIndex: 20 }}
                    allowEscapeViewBox={{ x: true, y: true }}
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  />

                  <Bar
                    dataKey="sales_amount"
                    radius={[0, 4, 4, 0]}
                    onClick={handleClick}
                    className="cursor-pointer"
                    barSize={itemsCount === 1 ? Math.min(BAR_SIZE, 40) : BAR_SIZE}
                    background={{ fill: '#F8FAFC' }}
                  >
                    {topProducts.map((entry, idx) => {
                      const isSelected = productIdFilter && entry.product_id === parseInt(productIdFilter);
                      let fillColor;
                      if (isSelected) {
                        fillColor = '#dc2626';
                      } else if (idx < 3) {
                        fillColor = '#16a34a';
                      } else {
                        fillColor = '#3bb3b3';
                      }
                      return <Cell key={`cell-${idx}`} fill={fillColor} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </Card>

      {/* SALES PERFORMANCE + FORECAST */}
      <Card
        title={selectedProductName ? `Sales Performance - ${selectedProductName}` : 'Sales Performance'}
        className="col-span-12 lg:col-span-8 h-[360px] md:h-[420px] lg:h-[480px] xl:h-[560px]"
        exportRef={salesChartRef}
      >
        <div className="flex flex-col h-full gap-6 max-h-full overflow-hidden relative">
          {loadingSalesPerformance && <ChartLoading message="Loading sales performance..." />}

          {/* Controls row (Interval + bulb) — aligned & tidy */}
          <div data-export-exclude className="flex justify-end items-end gap-3 mt-1">
            {/* Interval */}
            <div className="w-40">
              <DropdownCustom
                value={salesInterval}
                onChange={(v) => setSalesInterval(v?.target ? v.target.value : v)}
                label="Interval"
                variant="default"
                size="xs"
                options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'yearly', label: 'Yearly' },
                ]}
              />
            </div>

            {/* Restock suggestions */}
            {(hasActualData || hasForecastData) && (
              <div className="relative group shrink-0 z-10">
                <button
                  data-export-exclude
                  title="Get restocking suggestions"
                  aria-label="Get restocking suggestions"
                  onClick={() => setShowRestockDialog(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-600 hover:bg-green-700 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
                >
                  <FaLightbulb className="text-sm" />
                </button>
              </div>
            )}
          </div>

          {/* Sales line chart */}
          <div className="flex-1 min-h-0 overflow-hidden" data-chart-container="sales-performance">
            {(!hasActualData) ? (
              <ChartNoData
                message={selectedProductName ? `No sales performance data for ${selectedProductName}.` : 'No sales performance data for the selected filters.'}
                hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayActualSeries} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={formatPeriod} />

                  {(() => {
                    const maxSales = displayActualSeries.reduce((m, p) => Math.max(m, Number(p.sales_amount) || 0), 0);
                    const maxUnits = displayActualSeries.reduce((m, p) => Math.max(m, Number(p.units_sold) || 0), 0);
                    const overallMax = Math.max(maxSales, maxUnits);

                    if (overallMax <= 0) {
                      return (
                        <YAxis
                          type="number"
                          domain={[0, 1]}
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={pesoAxis} // ← show ₱ on zero-scale too
                        />
                      );
                    }

                    const target = Math.ceil(overallMax * 1.15);
                    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                    const padded = Math.ceil(target / magnitude) * magnitude;

                    return (
                      <YAxis
                        type="number"
                        domain={[0, padded]}
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={pesoAxis} // ← ₱ compact ticks
                      />
                    );
                  })()}


                  <Tooltip
                    labelFormatter={formatPeriod}
                    formatter={(value) => [currencyFormat(value), 'Sales']}
                  />

                  <Area type="monotone" dataKey="sales_amount" stroke="none" fillOpacity={1} fill="url(#colorSales)" />
                  <Line type="monotone" dataKey="sales_amount" name="Sales" stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Demand Forecasting */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[11px] tracking-wide font-semibold text-gray-500 uppercase">
                {selectedProductName ? `Demand Forecasting - ${selectedProductName} (Units Sold)` : 'Demand Forecasting (Units Sold)'}
              </h3>
            </div>

            {(!hasActualData && !hasForecastData) ? (
              <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
                <ChartNoData
                  message={selectedProductName ? `No units sold data for ${selectedProductName}.` : 'No units sold data for the selected filters.'}
                  hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY."
                />
              </div>
            ) : (
              <div className="h-52 flex-1 min-h-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartForecastData} margin={{ top: 0, right: 15, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0891b2" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="#f1f5f9" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={formatPeriod} />

                    {(() => {
                      const maxActual = displayActualSeries.reduce((m, p) => Math.max(m, Number(p.units_sold) || 0), 0);
                      const maxForecast = displayForecastSeries.reduce((m, p) => Math.max(m, Number(p.units_sold) || 0), 0);
                      const max = Math.max(maxActual, maxForecast);

                      if (max <= 0) return <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />;

                      const target = Math.ceil(max * 1.15);
                      const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                      const padded = Math.ceil(target / magnitude) * magnitude;

                      return <YAxis tick={{ fontSize: 10 }} domain={[0, padded]} />;
                    })()}

                    <Tooltip
                      labelFormatter={formatPeriod}
                      formatter={(value, name, entry) => {
                        if (value == null) return null;

                        if (entry?.dataKey === 'confidence_base') return null;

                        if (entry?.dataKey === 'confidence_span') {
                          const lower = entry?.payload?.forecast_lower;
                          const upper = entry?.payload?.forecast_upper;
                          if (lower == null || upper == null) return null;
                          return [`${Number(lower).toLocaleString()} - ${Number(upper).toLocaleString()} units`, 'Forecast Confidence'];
                        }

                        return [`${Number(value).toLocaleString()} units`, 'Units'];
                      }}
                    />

                    <Legend wrapperStyle={{ fontSize: '10px' }} />

                    {lastActualPeriod && (
                      <ReferenceLine
                        x={lastActualPeriod}
                        stroke="#94a3b8"
                        strokeDasharray="6 4"
                        label={{ value: 'Forecast begins', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }}
                      />
                    )}

                    {hasForecastData && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="confidence_base"
                          stackId="confidence"
                          stroke="none"
                          fill="transparent"
                          connectNulls
                          isAnimationActive={false}
                          legendType="none"
                        />
                        <Area
                          type="monotone"
                          dataKey="confidence_span"
                          name="Forecast Confidence"
                          stackId="confidence"
                          stroke="none"
                          fill="rgba(249, 115, 22, 0.16)"
                          connectNulls
                          activeDot={false}
                        />
                      </>
                    )}

                    <Area type="monotone" dataKey="actual_units" name="Actual Units" stroke="#0891b2" fillOpacity={1} fill="url(#colorUnits)" connectNulls={false} />
                    <Line type="monotone" dataKey="forecast_units" name="Forecast Units" stroke="#f97316" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Restock Suggestions Dialog */}
      <RestockSuggestionsDialog
        isOpen={showRestockDialog}
        onClose={() => setShowRestockDialog(false)}
        forecastData={forecastChartData}
        actualData={actualSeries}
        topProducts={Array.isArray(restockSuggestions) && restockSuggestions.length > 0 ? restockSuggestions : topProducts}
        salesInterval={salesInterval}
        categoryName={categoryName}
        selectedProductName={selectedProductName}
        loading={loadingRestockSuggestions}
      />
    </>
  );
}

export default TopProducts;
