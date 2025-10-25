import React, { useMemo } from 'react';
import { currencyFormat } from '../../utils/formatCurrency';
import {
  FaThumbsUp,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimes,
  FaCalendarAlt,
  FaChartLine
} from 'react-icons/fa';

const intervalLabelMap = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year'
};

const RestockSuggestionsDialog = ({
  isOpen,
  onClose,
  topProducts,
  salesInterval,
  categoryName,
  selectedProductName,
  loading = false
}) => {
  const coverageMultiplier = getIntervalMultiplier(salesInterval);
  const intervalLabel = intervalLabelMap[salesInterval] || 'period';
  const analysisFocus = selectedProductName || categoryName || 'All Products';

  const enhancedProducts = useMemo(() => {
    if (!Array.isArray(topProducts) || topProducts.length === 0) return [];

    const mapped = topProducts.map(product => {
      const historySeries = Array.isArray(product.history)
        ? product.history.map(entry => ({
            period: entry.period,
            units_sold: Number(entry.units_sold ?? 0),
            sales_amount: Number(entry.sales_amount ?? 0)
          }))
        : [];

      const forecastSeries = Array.isArray(product.forecast)
        ? product.forecast.map(entry => ({
            period: entry.period,
            forecast_units: Number(entry.forecast_units ?? entry.forecast ?? entry.units_sold ?? 0),
            forecast_lower: entry.forecast_lower != null ? Number(entry.forecast_lower) : null,
            forecast_upper: entry.forecast_upper != null ? Number(entry.forecast_upper) : null
          }))
        : [];

      const currentQuantity = product.current_quantity != null ? Number(product.current_quantity) : null;
      const minThreshold = product.min_threshold != null ? Number(product.min_threshold) : null;
      const maxThreshold = product.max_threshold != null ? Number(product.max_threshold) : null;
      const isLowStock =
        currentQuantity != null &&
        minThreshold != null &&
        minThreshold > 0 &&
        currentQuantity <= minThreshold;

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
        forecastSeries
      };
    });

    mapped.sort((a, b) => b.sales_amount - a.sales_amount);

    if (selectedProductName) {
      const selectedIndex = mapped.findIndex(product => product.product_name === selectedProductName);
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
    const topIds = new Set(topBySales.map(product => product.product_id));
    const lowStockExtras = enhancedProducts.filter(
      product => product.isLowStock && !topIds.has(product.product_id)
    );

    return [...topBySales, ...lowStockExtras];
  }, [enhancedProducts]);

  const productInsights = useMemo(() => {
    return prioritizedProducts.map((product, index) => {
      const historySeries = product.historySeries;
      const forecastSeries = product.forecastSeries;

      const periodsHistorical = historySeries.length;
      const totalHistoricalUnits = historySeries.reduce((sum, entry) => sum + entry.units_sold, 0);
      const averageHistoricalUnits = periodsHistorical > 0 ? totalHistoricalUnits / periodsHistorical : 0;
      const historyWindow = Math.max(1, Math.min(coverageMultiplier, periodsHistorical || 1));
      const historicalSuggested = Math.ceil(averageHistoricalUnits * historyWindow);

      const forecastWindow = Math.min(coverageMultiplier, forecastSeries.length);
      const totalForecastUnits = forecastWindow > 0
        ? forecastSeries.slice(0, forecastWindow).reduce((sum, entry) => sum + entry.forecast_units, 0)
        : 0;
      const forecastSuggested = Math.ceil(totalForecastUnits);

      const minTarget = product.min_threshold != null ? Math.ceil(product.min_threshold * 1.1) : 0;
      const targetStock = Math.max(forecastSuggested, minTarget);
      const restockGap = product.current_quantity != null ? Math.max(targetStock - product.current_quantity, 0) : targetStock;

      const confidence = computeConfidence(periodsHistorical, forecastSeries.length);

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
        historySeries,
        forecastSeries
      };
    });
  }, [prioritizedProducts, coverageMultiplier]);

  const hasData = productInsights.length > 0;
  const lowStockCount = productInsights.filter(product => product.lowStock).length;
  const maxHistoricalPeriods = productInsights.reduce((max, product) => Math.max(max, product.periodsHistorical), 0);
  const totalForecastPoints = productInsights.reduce((sum, product) => sum + product.forecastWindow, 0);
  const productsWithForecast = productInsights.filter(product => product.forecastWindow > 0).length;

  const periodDescriptor = maxHistoricalPeriods > 1
    ? `${maxHistoricalPeriods} previous ${intervalLabel}${maxHistoricalPeriods > 1 ? 's' : ''}`
    : maxHistoricalPeriods === 1
      ? `previous ${intervalLabel}`
      : 'limited recent history';

  if (!isOpen) return null;

  const hideScrollbarStyles = `
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .hide-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
  `;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
        <div className="p-7 border-b-2 border-black/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Restocking Suggestions</h2>
              <p className="text-sm text-gray-600">
                Recommendations for {analysisFocus} • {salesInterval} view
              </p>
            </div>
            <button
              onClick={onClose}
              className="hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close restocking suggestions dialog"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        <style>{hideScrollbarStyles}</style>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] hide-scrollbar">
          {loading ? (
            <div className="text-center py-12">
              <FaInfoCircle className="text-4xl text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Generating restock insights…</p>
              <p className="text-sm text-gray-500">We are refreshing Prophet forecasts to match the selected interval.</p>
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
              <div className="bg-gray-200 border border-gray-100 rounded-lg p-4 text-sm text-gray-600">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <span className="text-gray-500">Historical coverage</span>
                    <div className="font-medium text-gray-800">{periodDescriptor}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Forecast horizon</span>
                    <div className="font-medium text-gray-800">Up to {coverageMultiplier} {intervalLabel}{coverageMultiplier > 1 ? 's' : ''}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Prioritized products</span>
                    <div className="font-medium text-gray-800">{productInsights.length}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Low stock alerts</span>
                    <div className="font-medium text-gray-800">{lowStockCount}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Prophet forecasts available for {productsWithForecast} item{productsWithForecast === 1 ? '' : 's'} • Total forecast points analysed: {totalForecastPoints}.
                </div>
              </div>

              <section className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <FaCalendarAlt />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Restocking priorities</h3>
                    <p className="text-sm text-gray-500">Historical performance and Prophet forecast presented together for clarity.</p>
                  </div>
                </div>

                {productInsights.map(product => (
                  <div key={product.id} className="border border-gray-400 rounded-lg p-4 bg-white shadow-md hover:shadow-2xl hover:border-green-600 transition-all">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase">Priority {product.priority}</div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold text-gray-900">{product.name}</h4>
                          {product.lowStock && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                              <FaExclamationTriangle className="h-3 w-3" /> Low stock
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-600">{product.totalHistoricalUnits.toLocaleString()} units sold</div>
                        <div className="text-xs text-gray-500">{currencyFormat(product.salesAmount)}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                        <h5 className="text-sm font-semibold text-gray-800">Historical snapshot</h5>
                        {product.periodsHistorical === 0 ? (
                          <p className="mt-2 text-xs text-gray-500">Not enough historical data for this product.</p>
                        ) : (
                          <div className="mt-2 space-y-2 text-xs text-gray-600">
                            <div>
                              Average {Math.ceil(product.averageHistoricalUnits).toLocaleString()} unit{Math.ceil(product.averageHistoricalUnits) === 1 ? '' : 's'} per {intervalLabel} across {product.periodsHistorical} period{product.periodsHistorical === 1 ? '' : 's'}.
                            </div>
                            <div>
                              Suggested buffer from history: {product.historicalSuggested.toLocaleString()} unit{product.historicalSuggested === 1 ? '' : 's'} (~{product.historyWindow} {intervalLabel}{product.historyWindow > 1 ? 's' : ''}).
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-gray-100 bg-sky-50 p-4">
                        <h5 className="text-sm font-semibold text-gray-800">Prophet forecast</h5>
                        {product.forecastWindow === 0 ? (
                          <p className="mt-2 text-xs text-gray-500">Forecast unavailable — additional sales data is required.</p>
                        ) : (
                          <div className="mt-2 space-y-2 text-xs text-gray-600">
                            <div>
                              Prophet projects {Math.ceil(product.totalForecastUnits).toLocaleString()} unit{Math.ceil(product.totalForecastUnits) === 1 ? '' : 's'} in the next {product.forecastWindow} {intervalLabel}{product.forecastWindow > 1 ? 's' : ''}.
                            </div>
                            <div>
                              Forecast-based stock target: {product.forecastSuggested.toLocaleString()} unit{product.forecastSuggested === 1 ? '' : 's'}.
                            </div>
                          </div>
                        )}

                        {product.forecastSeries.length > 0 && (
                          <ul className="mt-3 space-y-1 text-[11px] text-gray-500">
                            {product.forecastSeries.slice(0, Math.min(product.forecastSeries.length, 3)).map(entry => (
                              <li key={entry.period}>
                                {entry.period}: {Math.ceil(entry.forecast_units).toLocaleString()} unit{Math.ceil(entry.forecast_units) === 1 ? '' : 's'} expected
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-xs text-gray-600 sm:grid-cols-3">
                      <div>
                        <span className="text-gray-500">Current stock</span>
                        <div className="text-sm font-medium text-gray-800">
                          {product.currentQuantity != null ? product.currentQuantity.toLocaleString() : 'Not provided'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Minimum threshold</span>
                        <div className="text-sm font-medium text-gray-800">
                          {product.minThreshold != null ? product.minThreshold.toLocaleString() : 'Not set'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Forecast target</span>
                        <div className="text-sm font-medium text-gray-800">
                          {product.targetStock.toLocaleString()} unit{product.targetStock === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FaThumbsUp className="text-green-600" />
                        {product.restockGap > 0
                          ? `Restock ${product.restockGap.toLocaleString()} unit${product.restockGap === 1 ? '' : 's'} to reach the Prophet-driven target of ${product.targetStock.toLocaleString()} units.`
                          : 'Current inventory already meets the forecast coverage window.'}
                      </div>
                      <div className="text-xs font-semibold text-gray-500">
                        Confidence:&nbsp;
                        <span className={confidenceTone(product.confidence)}>{product.confidence.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}
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

export default RestockSuggestionsDialog;
