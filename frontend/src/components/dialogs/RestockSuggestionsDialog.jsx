import React, { useMemo, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { currencyFormat } from '../../utils/formatCurrency';
import { FaExclamationTriangle, FaInfoCircle, FaCalendarAlt } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import useModalLock from '../../hooks/useModalLock'; // adjust path if needed

const intervalLabelMap = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

const RestockSuggestionsDialog = ({
  isOpen,
  onClose,
  topProducts,
  salesInterval,
  categoryName,
  selectedProductName,
  loading = false,
}) => {
  const coverageMultiplier = getIntervalMultiplier(salesInterval);
  const intervalLabel = intervalLabelMap[salesInterval] || 'period';
  const analysisFocus = selectedProductName || categoryName || 'All Products';

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Prevent background scroll and make Back button close this dialog
  useModalLock(isOpen, handleClose);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  const enhancedProducts = useMemo(() => {
    if (!Array.isArray(topProducts) || topProducts.length === 0) return [];

    const mapped = topProducts.map((product) => {
      const historySeriesRaw = Array.isArray(product.history)
        ? product.history.map((entry) => ({
            period: entry.period,
            units_sold: Number(entry.units_sold ?? 0),
            sales_amount: Number(entry.sales_amount ?? 0),
          }))
        : [];

      const historySeries = historySeriesRaw
        .slice()
        .sort((a, b) => (a.period || '').localeCompare(b.period || ''));

      const forecastSeries = Array.isArray(product.forecast)
        ? product.forecast
            .map((entry) => ({
              period: entry.period,
              forecast_units: Number(entry.forecast_units ?? entry.forecast ?? entry.units_sold ?? 0),
              forecast_lower: entry.forecast_lower != null ? Number(entry.forecast_lower) : null,
              forecast_upper: entry.forecast_upper != null ? Number(entry.forecast_upper) : null,
            }))
            .sort((a, b) => (a.period || '').localeCompare(b.period || ''))
        : [];

      const forecastContext = product.forecast_context ?? null;

      const historyRangeStart = product.history_range_start || (historySeries[0]?.period ?? null);
      const historyRangeEnd = product.history_range_end || (historySeries[historySeries.length - 1]?.period ?? null);
      const historyCoverageDays = product.history_coverage_days ?? (
        historyRangeStart && historyRangeEnd && dayjs(historyRangeStart).isValid() && dayjs(historyRangeEnd).isValid()
          ? dayjs(historyRangeEnd).diff(dayjs(historyRangeStart), 'day') + 1
          : 0
      );

      const currentQuantity = product.current_quantity != null ? Number(product.current_quantity) : null;
      const minThreshold = product.min_threshold != null ? Number(product.min_threshold) : null;
      const maxThreshold = product.max_threshold != null ? Number(product.max_threshold) : null;
      const isLowStock =
        currentQuantity != null && minThreshold != null && minThreshold > 0 && currentQuantity <= minThreshold;

      return {
        product_id: product.product_id,
        product_name: product.product_name,
        sales_amount: Number(product.sales_amount || 0),
        units_sold: Number(product.units_sold || 0),
        current_quantity: currentQuantity,
        min_threshold: minThreshold,
        max_threshold: maxThreshold,
        isLowStock,
        historySeries,
        forecastSeries,
        forecastContext,
        historyRangeStart,
        historyRangeEnd,
        historyCoverageDays,
      };
    });

    mapped.sort((a, b) => b.sales_amount - a.sales_amount);

    if (selectedProductName) {
      const selectedIndex = mapped.findIndex((p) => p.product_name === selectedProductName);
      if (selectedIndex > 0) {
        const [selected] = mapped.splice(selectedIndex, 1);
        mapped.unshift(selected);
      }
    }

    return mapped;
  }, [topProducts, selectedProductName]);

  const prioritizedProducts = useMemo(() => {
    if (enhancedProducts.length === 0) return [];
    const topBySales = enhancedProducts.slice(0, Math.min(5, enhancedProducts.length));
    const topIds = new Set(topBySales.map((p) => p.product_id));
    const lowStockExtras = enhancedProducts.filter((p) => p.isLowStock && !topIds.has(p.product_id));
    return [...topBySales, ...lowStockExtras];
  }, [enhancedProducts]);

  const productInsights = useMemo(() => {
    return prioritizedProducts.map((product, index) => {
      const historySeries = product.historySeries;
      const forecastSeries = product.forecastSeries;
      const forecastContext = product.forecastContext;
      const historyRangeStart = product.historyRangeStart;
      const historyRangeEnd = product.historyRangeEnd;
      const historyCoverageDays = product.historyCoverageDays;
      const historyCoverageLabel = formatHistoryRange(historyRangeStart, historyRangeEnd);
      const historyCoverageMonths =
        historyRangeStart &&
        historyRangeEnd &&
        dayjs(historyRangeStart).isValid() &&
        dayjs(historyRangeEnd).isValid()
          ? dayjs(historyRangeEnd).diff(dayjs(historyRangeStart), 'month', true)
          : 0;

      const periodsHistorical = historySeries.length;
      const totalHistoricalUnits = historySeries.reduce((s, e) => s + e.units_sold, 0);
      const averageHistoricalUnits = periodsHistorical > 0 ? totalHistoricalUnits / periodsHistorical : 0;
      const historyWindow = Math.max(1, Math.min(coverageMultiplier, periodsHistorical || 1));
      const historicalSuggested = Math.ceil(averageHistoricalUnits * historyWindow);

      const forecastWindow = Math.min(coverageMultiplier, forecastSeries.length);
      const totalForecastUnits =
        forecastWindow > 0 ? forecastSeries.slice(0, forecastWindow).reduce((s, e) => s + e.forecast_units, 0) : 0;
      const forecastSuggested = Math.ceil(totalForecastUnits);

      const minTarget = product.min_threshold != null ? Math.ceil(product.min_threshold * 1.1) : 0;
      const targetStock = Math.max(forecastSuggested, minTarget);
      const restockGap =
        product.current_quantity != null ? Math.max(targetStock - product.current_quantity, 0) : targetStock;

      const confidence = computeConfidence(periodsHistorical, forecastSeries.length);
      const unitPrice = totalHistoricalUnits > 0 ? product.sales_amount / totalHistoricalUnits : 0;
      const allocationCost = restockGap * unitPrice;

      return {
        id: product.product_id ?? `product-${index}`,
        priority: index + 1,
        name: product.product_name,
        lowStock: product.isLowStock,
        currentQuantity: product.current_quantity,
        minThreshold: product.min_threshold,
        maxThreshold: product.max_threshold,
        salesAmount: product.sales_amount,
        totalHistoricalUnits,
        periodsHistorical,
        averageHistoricalUnits,
        historyWindow,
        historicalSuggested,
        forecastWindow,
        totalForecastUnits,
        forecastSuggested,
        targetStock,
        restockGap,
        confidence,
        unitPrice,
        allocationCost,
        historySeries,
        forecastSeries,
        forecastContext,
        historyRangeStart,
        historyRangeEnd,
        historyCoverageDays,
        historyCoverageLabel,
        historyCoverageMonths,
      };
    });
  }, [prioritizedProducts, coverageMultiplier]);

  const totalAllocation = productInsights.reduce((sum, p) => sum + p.allocationCost, 0);
  const hasData = productInsights.length > 0;
  const lowStockCount = productInsights.filter((p) => p.lowStock).length;
  const totalForecastPoints = productInsights.reduce((s, p) => s + p.forecastWindow, 0);
  const productsWithForecast = productInsights.filter((p) => p.forecastWindow > 0).length;

  if (!isOpen) return null;

  const hideScrollbarStyles = `
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .hide-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <style>{hideScrollbarStyles}</style>

      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="relative bg-white rounded-lg w-full max-w-4xl h-[90vh] max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="relative px-4 sm:px-6 md:px-7 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Restocking Suggestions</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Recommendations for {analysisFocus} • {salesInterval} view
              </p>
            </div>

            <button
              onClick={handleClose}
              aria-label="Close"
              className="shrink-0 text-gray-600 top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 "
            >
              <IoMdClose className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-4 sm:px-6 md:px-7 py-4 sm:py-6 pb-28 sm:pb-32">
          {loading ? (
            <div className="text-center py-12">
              <FaInfoCircle className="text-4xl text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Generating restock insights…</p>
              <p className="text-sm text-gray-500">
                We are refreshing Prophet forecasts to match the selected interval.
              </p>
            </div>
          ) : !hasData ? (
            <div className="text-center py-12">
              <FaInfoCircle className="text-4xl text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No restocking insights available yet</p>
              <p className="text-sm text-gray-500">
                Supply data becomes available once products record sales history and Prophet can generate forecasts.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary card */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Forecast horizon</div>
                    <div className="font-semibold text-gray-900">
                      Up to {coverageMultiplier} {intervalLabel}
                      {coverageMultiplier > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Prioritized products</div>
                    <div className="font-semibold text-gray-900">{productInsights.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Low stock alerts</div>
                    <div className="font-semibold text-gray-900">{lowStockCount}</div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-gray-500">
                  Prophet forecasts available for {productsWithForecast} item
                  {productsWithForecast === 1 ? '' : 's'} • Total forecast points analysed: {totalForecastPoints}.
                </div>
              </div>

              {/* Section title */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <FaCalendarAlt />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Restocking priorities</h3>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Historical performance and Prophet forecast presented together for clarity.
                    </p>
                  </div>
                </div>

                {productInsights.map((p) => (
                  <div
                    key={p.id}
                    className="border border-emerald-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-lg hover:border-emerald-400 transition-all"
                  >
                    {/* TOP ROW: Priority (left) + Low stock (right) */}
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] sm:text-xs font-semibold tracking-wide text-gray-500 uppercase">
                        Priority {p.priority}
                      </div>

                      {p.lowStock && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] sm:text-[12px] font-semibold text-red-600">
                          <FaExclamationTriangle className="h-3 w-3" />
                          Low stock
                        </span>
                      )}
                    </div>

                    {/* NAME + METRICS ROW */}
                    <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-base sm:text-lg font-semibold text-gray-900 whitespace-normal break-words">
                          {p.name}
                        </h4>

                        <div className="mt-1 text-[11px] sm:text-xs text-gray-500">
                          Confidence:{' '}
                          <span className={confidenceTone(p.confidence)}>{p.confidence.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 mt-1 sm:mt-0">
                        <div className="text-xs sm:text-sm font-semibold text-emerald-700">
                          {`Unit quantity sold (${p.totalHistoricalUnits.toLocaleString()})`}
                        </div>
                        <div className="text-[11px] sm:text-xs text-gray-500">
                          Qty left: {p.currentQuantity != null ? p.currentQuantity.toLocaleString() : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Two columns on md+, stacked on mobile */}
                    <div className="mt-4 flex flex-col md:flex-row md:items-stretch md:gap-4">
                      {/* Historical snapshot */}
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 md:flex-1 flex flex-col items-center justify-center text-center">
                        <h5 className="text-sm font-semibold text-gray-800">Historical snapshot</h5>
                        {p.periodsHistorical === 0 ? (
                          <p className="mt-2 text-xs text-gray-500">
                            Not enough historical data for this product.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2 text-gray-600">
                            <div className="text-2xl font-extrabold text-gray-900">
                              {Math.ceil(p.averageHistoricalUnits).toLocaleString()}
                            </div>
                            <div className="text-xs sm:text-sm">
                              avg units per {intervalLabel}
                            </div>
                            <div className="text-[11px] sm:text-xs text-gray-500">
                              {p.historyCoverageLabel
                                ? `Coverage: ${p.historyCoverageLabel}`
                                : `Based on ${p.periodsHistorical} ${intervalLabel}${
                                    p.periodsHistorical === 1 ? '' : 's'
                                  }`}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Recommendation */}
                      <div className="rounded-lg bg-emerald-50 p-4 md:flex-1 md:border-l md:border-gray-200 md:pl-4 flex flex-col items-center justify-center">
                        <div className="w-full text-center">
                          <div className="text-sm font-semibold text-gray-700 mb-2">
                            Recommended restocking
                          </div>
                          <div className="flex items-center justify-center">
                            <div className="text-center">
                              <div className="mt-1 text-2xl md:text-3xl font-extrabold text-emerald-900">
                                {Math.ceil(p.totalForecastUnits).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                in next {p.forecastWindow} {intervalLabel}
                                {p.forecastWindow > 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>

                          {p.forecastWindow === 0 ? (
                            <p className="mt-2 text-xs text-gray-500">
                              Forecast unavailable — additional sales data is required.
                            </p>
                          ) : (
                            <div className="mt-2 text-xs text-gray-600" />
                          )}

                          {p.forecastContext?.message && (
                            <div className="mt-3 rounded-md border border-emerald-200 bg-white/70 px-3 py-2 text-left text-xs text-gray-700">
                              {p.forecastContext.message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}
        </div>

        {/* Footer — always visible */}
        <div
          className="sticky bottom-0 z-20 border-t border-gray-200 bg-white px-4 sm:px-6 md:px-7 py-3 sm:py-4 shadow-[0_-6px_12px_-6px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm sm:text-base text-gray-700">
                Budget allocation recommendation
              </div>
              <div className="text-lg sm:text-2xl font-extrabold text-gray-900 mt-1">
                {currencyFormat(totalAllocation)}
              </div>
              <div className="text-[11px] sm:text-xs text-gray-500">
                Total to allocate for the recommended restocking (based on {intervalLabel} forecast)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function getIntervalMultiplier(interval) {
  switch (interval) {
    case 'daily':
      return 7;
    case 'weekly':
      return 4;
    case 'monthly':
      return 3;
    case 'yearly':
      return 1;
    default:
      return 2;
  }
}

function computeConfidence(historyPeriods, forecastPeriods) {
  const totalPoints = historyPeriods + forecastPeriods;
  if (forecastPeriods >= historyPeriods && totalPoints >= 10) return 'high';
  if (forecastPeriods > 0 && totalPoints >= 6) return 'medium';
  return 'low';
}

function confidenceTone(confidence) {
  if (confidence === 'high') return 'text-green-600';
  if (confidence === 'medium') return 'text-orange-600';
  return 'text-gray-600';
}

function formatHistoryRange(start, end) {
  if (!start || !end) {
    return null;
  }
  const startDate = dayjs(start);
  const endDate = dayjs(end);
  if (!startDate.isValid() || !endDate.isValid()) {
    return null;
  }
  if (startDate.year() === endDate.year() && startDate.month() === endDate.month()) {
    return startDate.format('MMM YYYY');
  }
  return `${startDate.format('MMM YYYY')} – ${endDate.format('MMM YYYY')}`;
}

export default RestockSuggestionsDialog;
