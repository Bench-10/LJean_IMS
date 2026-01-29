import React, { useEffect, useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import { currencyFormat } from '../../../utils/formatCurrency';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Area, Legend, Cell, ReferenceLine, ComposedChart, LabelList
} from 'recharts';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';
import RestockSuggestionsDialog from '../../dialogs/RestockSuggestionsDialog.jsx';
import { FaLightbulb } from 'react-icons/fa';

import DropdownCustom from '../../../components/DropdownCustom';

const INITIAL_TOP_PRODUCTS_PAGE = 10;
const TOP_PRODUCTS_LIMIT = 24;
const SALES_SERIES_LIMIT = 480;
const FORECAST_SERIES_LIMIT = 360;
const PROGRESSIVE_SEGMENTS = 6;
const PROGRESSIVE_INTERVAL_MS = 90;
const MIN_PROGRESSIVE_CHUNK = 6;
const MOBILE_SERIES_CAP = 8;

const buildSampledIndices = (length, limit, includeIndices = []) => {
  if (!Number.isFinite(length) || length <= 0) return [];
  if (!limit || length <= limit) {
    return Array.from({ length }, (_, index) => index);
  }

  const step = Math.ceil(length / limit);
  const indices = new Set(includeIndices.filter((index) => index >= 0 && index < length));
  for (let i = 0; i < length; i += step) indices.add(i);
  indices.add(length - 1);
  return Array.from(indices).sort((a, b) => a - b);
};

const sampleArray = (input, limit, includeIndices = []) => {
  if (!Array.isArray(input)) return [];
  const indices = buildSampledIndices(input.length, limit, includeIndices);
  return indices.map((index) => input[index]).filter((item) => item !== undefined);
};

const getProgressiveChunkSize = (length) => {
  if (!Number.isFinite(length) || length <= 0) return 0;
  const base = Math.ceil(length / PROGRESSIVE_SEGMENTS);
  return Math.max(MIN_PROGRESSIVE_CHUNK, base);
};

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
  loadingRestockSuggestions, restockSuggestions, dateRangeDisplay, topProductsRef, salesChartRef,
  globalStartDate, globalEndDate, salesIntervalOptions,
  onRetryTopProducts, onRetrySalesPerformance
}) {
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_TOP_PRODUCTS_PAGE);
  const [screenDimensions, setScreenDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  }));

  const intervalOptions = useMemo(() => {
    if (Array.isArray(salesIntervalOptions) && salesIntervalOptions.length) {
      return salesIntervalOptions;
    }
    return [
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' }
    ];
  }, [salesIntervalOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setScreenDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = screenDimensions.width < 640;
  const currencyAxisProps = useMemo(() => (
    isMobile
      ? { hide: true }
      : { tick: { fontSize: 10 }, axisLine: false, tickLine: false, tickFormatter: pesoAxis }
  ), [isMobile]);
  const numericAxisProps = useMemo(() => (
    isMobile
      ? { hide: true }
      : { tick: { fontSize: 10 }, axisLine: false, tickLine: false }
  ), [isMobile]);
  const salesChartHeight = isMobile ? 320 : 380;
  const demandChartHeight = isMobile ? 320 : 280;

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

  const selectedProductIndex = useMemo(() => {
    if (!productIdFilter || !Array.isArray(topProducts)) return -1;
    return topProducts.findIndex((p) => p?.product_id === parseInt(productIdFilter, 10));
  }, [productIdFilter, topProducts]);

  useEffect(() => {
    setVisibleCount(INITIAL_TOP_PRODUCTS_PAGE);
  }, [categoryName, productIdFilter]);

  const virtualizedTopProducts = useMemo(() => {
    if (!Array.isArray(topProducts) || !topProducts.length) return [];
    const include = selectedProductIndex >= 0 ? [selectedProductIndex] : [];
    const sampled = sampleArray(topProducts, TOP_PRODUCTS_LIMIT, include);
    return sampled.length ? sampled : topProducts.slice(0, TOP_PRODUCTS_LIMIT);
  }, [selectedProductIndex, topProducts]);

  const totalTopProducts = Array.isArray(topProducts) ? topProducts.length : 0;
  const baseDisplay = useMemo(() => {
    if (!Array.isArray(topProducts) || !topProducts.length) return [];
    if (totalTopProducts <= TOP_PRODUCTS_LIMIT || visibleCount > TOP_PRODUCTS_LIMIT) {
      return topProducts;
    }
    if (virtualizedTopProducts.length) return virtualizedTopProducts;
    return topProducts.slice(0, TOP_PRODUCTS_LIMIT);
  }, [topProducts, totalTopProducts, visibleCount, virtualizedTopProducts]);
  const topProductsDisplay = baseDisplay.slice(0, Math.min(visibleCount, baseDisplay.length));

  const VISIBLE_ROWS = isMobile ? 7 : 10;
  const BAR_SIZE = 30;
  const ROW_GAP = 44;
  const MARGIN_TOP = 10;
  const MARGIN_BOTTOM = 10;

  const itemsCount = Array.isArray(topProductsDisplay) ? topProductsDisplay.length : 0;

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

  const rawCombinedSeries = useMemo(() => {
    if (Array.isArray(normalizedPerformance.series) && normalizedPerformance.series.length) {
      return normalizedPerformance.series;
    }
    if (Array.isArray(normalizedPerformance.history)) {
      return normalizedPerformance.history.map(item => ({ ...item, is_forecast: false }));
    }
    return [];
  }, [normalizedPerformance.history, normalizedPerformance.series]);

  const rangeStart = useMemo(() => {
    if (!globalStartDate) return null;
    const parsed = dayjs(globalStartDate, 'YYYY-MM-DD');
    return parsed.isValid() ? parsed.startOf('day') : null;
  }, [globalStartDate]);

  const rangeEnd = useMemo(() => {
    if (!globalEndDate) return null;
    const parsed = dayjs(globalEndDate, 'YYYY-MM-DD');
    return parsed.isValid() ? parsed.endOf('day') : null;
  }, [globalEndDate]);

  const getPeriodBounds = useCallback((period) => {
    if (period == null) return null;
    const value = String(period);

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = dayjs(value, 'YYYY-MM-DD');
      if (!date.isValid()) return null;
      return { start: date.startOf('day'), end: date.endOf('day') };
    }

    if (/^\d{4}-\d{2}$/.test(value)) {
      const month = dayjs(`${value}-01`, 'YYYY-MM-DD');
      if (!month.isValid()) return null;
      return { start: month.startOf('month'), end: month.endOf('month') };
    }

    if (/^\d{4}$/.test(value)) {
      const year = dayjs(value, 'YYYY');
      if (!year.isValid()) return null;
      return { start: year.startOf('year'), end: year.endOf('year') };
    }

    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      const date = dayjs(isoMatch[1], 'YYYY-MM-DD');
      if (date.isValid()) {
        return { start: date.startOf('day'), end: date.endOf('day') };
      }
    }

    return null;
  }, []);

  const isWithinGlobalRange = useCallback((period) => {
    if (!rangeStart && !rangeEnd) return true;
    const bounds = getPeriodBounds(period);
    if (!bounds) return true;
    if (rangeStart && bounds.end.isBefore(rangeStart, 'day')) return false;
    if (rangeEnd && bounds.start.isAfter(rangeEnd, 'day')) return false;
    return true;
  }, [getPeriodBounds, rangeEnd, rangeStart]);

  // Only surface forecast data when the selected range ends today.
  const shouldShowForecast = useMemo(() => {
    if (!globalEndDate) return false;
    const end = dayjs(globalEndDate, 'YYYY-MM-DD');
    if (!end.isValid()) return false;
    if (!Array.isArray(rawCombinedSeries) || !rawCombinedSeries.length) return false;
    const hasForecastEntries = rawCombinedSeries.some((item) => item && item.is_forecast === true);
    if (!hasForecastEntries) return false;
    return end.endOf('day').isSame(dayjs().endOf('day'));
  }, [globalEndDate, rawCombinedSeries]);

  const combinedSeries = useMemo(() => {
    if (!Array.isArray(rawCombinedSeries) || !rawCombinedSeries.length) return [];
    return rawCombinedSeries.filter((item) => {
      if (!item) return false;
      if (item.is_forecast === true) {
        return shouldShowForecast;
      }
      return isWithinGlobalRange(item.period);
    });
  }, [isWithinGlobalRange, rawCombinedSeries, shouldShowForecast]);

  const actualSeries = useMemo(() => (
    combinedSeries
      .filter(item => item && item.is_forecast !== true)
      .map(item => ({
        ...item,
        sales_amount: Number(item.sales_amount ?? item.amount ?? 0),
        units_sold: Number(item.units_sold ?? item.value ?? 0)
      }))
  ), [combinedSeries]);

  const forecastSeries = useMemo(() => (
    combinedSeries
      .filter(item => item && item.is_forecast === true)
      .map(item => ({
        ...item,
        sales_amount: Number(item.sales_amount ?? item.amount ?? 0),
        units_sold: Number(item.units_sold ?? item.value ?? item.forecast ?? 0)
      }))
  ), [combinedSeries]);

  const hasActualData = actualSeries.length > 0;
  const hasForecastData = forecastSeries.length > 0;

  // NEW — historical limit per granularity
  const historicalLimits = {
    daily: 15,
    weekly: 8,
    monthly: 12,
    yearly: 6
  };
  const baseHistoricalLimit = historicalLimits[salesInterval] ?? null;
  const historicalLimit = useMemo(() => {
    if (!isMobile) return baseHistoricalLimit;
    if (!baseHistoricalLimit) return MOBILE_SERIES_CAP;
    return Math.min(baseHistoricalLimit, MOBILE_SERIES_CAP);
  }, [baseHistoricalLimit, isMobile]);

  const displayActualSeries = useMemo(() => {
    if (!historicalLimit || actualSeries.length <= historicalLimit) return actualSeries;
    return actualSeries.slice(-historicalLimit);
  }, [actualSeries, historicalLimit]);

  const displayCombinedSeries = useMemo(() => {
    const limitForecastEntries = (series) => {
      if (!isMobile) return series;
      let forecastCount = 0;
      return series.filter((item) => {
        if (item && item.is_forecast === true) {
          forecastCount += 1;
          return forecastCount <= MOBILE_SERIES_CAP;
        }
        return true;
      });
    };

    if (!historicalLimit || actualSeries.length <= historicalLimit) {
      return limitForecastEntries(combinedSeries);
    }
    const allowedPeriods = new Set(displayActualSeries.map(item => item.period));
    const filteredSeries = combinedSeries.filter(item => item.is_forecast === true || allowedPeriods.has(item.period));
    return limitForecastEntries(filteredSeries);
  }, [combinedSeries, displayActualSeries, actualSeries.length, historicalLimit, isMobile]);

  const displayForecastSeries = useMemo(() => {
    if (!historicalLimit || actualSeries.length <= historicalLimit) {
      if (!isMobile) return forecastSeries;
      return forecastSeries.slice(0, MOBILE_SERIES_CAP);
    }
    const limited = displayCombinedSeries.filter(item => item && item.is_forecast === true);
    if (!isMobile) return limited;
    return limited.slice(0, MOBILE_SERIES_CAP);
  }, [displayCombinedSeries, forecastSeries, historicalLimit, actualSeries.length, isMobile]);

  const [progressiveCount, setProgressiveCount] = useState(() => {
    if (!displayActualSeries.length) return 0;
    return Math.min(getProgressiveChunkSize(displayActualSeries.length), displayActualSeries.length);
  });

  useEffect(() => {
    if (!displayActualSeries.length) {
      setProgressiveCount(0);
      return;
    }
    const initial = Math.min(getProgressiveChunkSize(displayActualSeries.length), displayActualSeries.length);
    setProgressiveCount(initial || displayActualSeries.length);
  }, [displayActualSeries.length]);

  useEffect(() => {
    if (!displayActualSeries.length) return;
    if (progressiveCount >= displayActualSeries.length) return;
    const chunk = Math.max(getProgressiveChunkSize(displayActualSeries.length), MIN_PROGRESSIVE_CHUNK);
    const timer = setInterval(() => {
      setProgressiveCount((prev) => {
        if (prev >= displayActualSeries.length) return prev;
        return Math.min(prev + chunk, displayActualSeries.length);
      });
    }, PROGRESSIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [displayActualSeries.length, progressiveCount]);

  const progressiveActualSeries = useMemo(() => {
    if (!displayActualSeries.length) return [];
    if (!progressiveCount) return displayActualSeries.slice(0, getProgressiveChunkSize(displayActualSeries.length) || displayActualSeries.length);
    return displayActualSeries.slice(0, Math.min(progressiveCount, displayActualSeries.length));
  }, [displayActualSeries, progressiveCount]);

  const lineChartData = progressiveActualSeries.length ? progressiveActualSeries : displayActualSeries;
  const progressiveProgress = displayActualSeries.length
    ? Math.min(100, Math.round((Math.min(progressiveCount, displayActualSeries.length) / displayActualSeries.length) * 100))
    : 100;

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
        className="relative col-span-12 lg:col-span-4"
        exportRef={topProductsRef}
        exportId="top-products"
        exportSpans={{ lg: 4 }}
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
            {(!topProductsDisplay || topProductsDisplay.length === 0) ? (
              <ChartNoData message="No top products for the selected filters." onRetry={onRetryTopProducts} />
            ) : (
              <ResponsiveContainer width="100%" height={totalHeight}>
                <BarChart
                  data={topProductsDisplay}
                  margin={{ top: MARGIN_TOP, right: 15, left: 15, bottom: MARGIN_BOTTOM }}
                  layout="vertical"
                  barCategoryGap={itemsCount === 1 ? 20 : ROW_GAP}
                  barGap={0}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  {(() => {
                    const max = topProductsDisplay.reduce((m, p) => Math.max(m, Number(p.sales_amount) || 0), 0);
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
                    tick={{ fontSize: isMobile ? 9 : 11 }}
                    width={isMobile ? 68 : 84}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tickMargin={4}
                  />

                  {/* Compact, wrapping tooltip */}
                  <Tooltip
                    content={<TopBarTooltip />}
                    wrapperStyle={{ outline: 'none', zIndex: 20 }}
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
                    {topProductsDisplay.map((entry, idx) => {
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
                    <LabelList
                      dataKey="sales_amount"
                      position="right"
                      formatter={(value) => currencyFormat(value).replace('₱ ', '₱')}
                      style={{ fontSize: isMobile ? 9 : 10, fill: '#0f172a', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500" data-export-exclude>
              <span>
                Showing {topProductsDisplay.length} of {totalTopProducts} products
              </span>
              {topProductsDisplay.length < totalTopProducts && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => Math.min(prev + INITIAL_TOP_PRODUCTS_PAGE, totalTopProducts))}
                  className="ml-2 inline-flex items-center px-2 py-1 rounded border border-gray-300 bg-white text-[10px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  Show more
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* SALES PERFORMANCE + FORECAST */}
      <Card
        title={selectedProductName ? `Sales Performance - ${selectedProductName}` : 'Sales Performance'}
        className="col-span-12 lg:col-span-8"
        exportRef={salesChartRef}
        exportId="sales-performance"
        exportSpans={{ lg: 8 }}
      >
        <div className="flex flex-col gap-6 relative">
          {loadingSalesPerformance && <ChartLoading message="Loading sales performance..." />}
          {progressiveProgress < 100 && !loadingSalesPerformance && (
            <div className="absolute top-2 right-3 z-10 px-2 py-1 text-[10px] rounded-md bg-white/90 border border-gray-200 shadow-sm" data-export-exclude>
              Rendering {progressiveProgress}% of series…
            </div>
          )}

          {/* Controls row (Interval + bulb) — aligned & tidy */}
          <div data-export-exclude className={`flex items-end gap-3 mt-1 ${isMobile ? 'justify-between w-full' : 'justify-end'}`}>
            {/* Interval */}
            <div className={isMobile ? 'flex-1' : 'w-40'}>
              <DropdownCustom
                value={salesInterval}
                onChange={(v) => setSalesInterval(v?.target ? v.target.value : v)}
                label="Interval"
                variant="default"
                size="xs"
                options={intervalOptions}
                disabled={intervalOptions.length <= 1}
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
          <div
            className={`${isMobile ? 'h-[320px]' : 'h-[380px]'} overflow-hidden`}
            data-chart-container="sales-performance"
            style={salesChartHeight ? { height: salesChartHeight } : undefined}
          >
            {(!hasActualData) ? (
              <ChartNoData
                message={selectedProductName ? `No sales performance data for ${selectedProductName}.` : 'No sales performance data for the selected filters.'}
                hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY."
                onRetry={onRetrySalesPerformance}
              />
            ) : (
              <ResponsiveContainer width="100%" height={salesChartHeight}>
                <LineChart data={lineChartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
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
                          {...currencyAxisProps}
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
                        {...currencyAxisProps}
                      />
                    );
                  })()}


                  <Tooltip
                    labelFormatter={formatPeriod}
                    formatter={(value) => [currencyFormat(value), 'Sales']}
                  />

                  <Area type="monotone" dataKey="sales_amount" stroke="none" fillOpacity={1} fill="url(#colorSales)" />
                  <Line type="monotone" dataKey="sales_amount" name="Sales" stroke="#0f766e" strokeWidth={2} dot={{ r: 3, fill: '#0f766e', strokeWidth: 0 }}>
                    <LabelList
                      dataKey="sales_amount"
                      position="top"
                      offset={8}
                      formatter={(value) => {
                        if (value == null || value === 0) return '';
                        if (value >= 1000000) return `₱${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `₱${(value / 1000).toFixed(1)}K`;
                        return `₱${value.toLocaleString()}`;
                      }}
                      style={{ fontSize: 9, fill: '#0f766e', fontWeight: 600 }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Demand Forecasting */}
          <div className={`flex flex-col ${isMobile ? '' : 'flex-1 min-h-0'}`}>
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
                  onRetry={onRetrySalesPerformance}
                />
              </div>
            ) : (
              <div
                className={`${isMobile ? 'h-[320px]' : 'h-[280px]'} overflow-hidden`}
                style={demandChartHeight ? { height: demandChartHeight } : undefined}
              >
                <ResponsiveContainer width="100%" height={demandChartHeight}>
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

                      if (max <= 0) {
                        return (
                          <YAxis
                            domain={[0, 1]}
                            {...numericAxisProps}
                          />
                        );
                      }

                      const target = Math.ceil(max * 1.15);
                      const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                      const padded = Math.ceil(target / magnitude) * magnitude;

                      return (
                        <YAxis
                          domain={[0, padded]}
                          {...numericAxisProps}
                        />
                      );
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

                    {hasForecastData && lastActualPeriod && (
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

                    <Area type="monotone" dataKey="actual_units" name="Actual Units" stroke="#0891b2" fillOpacity={1} fill="url(#colorUnits)" connectNulls={false}>
                      <LabelList
                        dataKey="actual_units"
                        position="top"
                        offset={8}
                        formatter={(value) => {
                          if (value == null || value === 0) return '';
                          if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                          if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                          return value.toLocaleString();
                        }}
                        style={{ fontSize: 9, fill: '#0891b2', fontWeight: 600 }}
                      />
                    </Area>
                    {hasForecastData && (
                      <Line type="monotone" dataKey="forecast_units" name="Forecast Units" stroke="#f97316" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} connectNulls={false}>
                        <LabelList
                          dataKey="forecast_units"
                          position="top"
                          offset={8}
                          formatter={(value) => {
                            if (value == null || value === 0) return '';
                            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                            return value.toLocaleString();
                          }}
                          style={{ fontSize: 9, fill: '#f97316', fontWeight: 600 }}
                        />
                      </Line>
                    )}
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
