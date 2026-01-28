import React, { useMemo, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, LabelList
} from 'recharts';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';
import DropdownCustom from '../../../components/DropdownCustom';

function Delivery({
  Card,
  deliveryData,
  deliveryInterval,
  setDeliveryInterval,
  deliveryStatus,
  setDeliveryStatus,
  loadingDelivery,
  deliveryChartRef,
  onLoadOlder = () => {},
  onResetRange = () => {},
  canLoadOlder = true,
  hasExtendedRange = false,
  rangeLabel = '',
  windowLabel = '',
  globalStartDate = null,
  globalEndDate = null,
  deliveryPage = 0,
  deliveryTotalPages = null,
  deliveryWindowSize = 5,
  isMobileView = false
}) {
  // globalStartDate / globalEndDate are provided by the parent analytics dashboard
  // and define the global date range the dashboard is operating in. These are
  // expected to be ISO dates (YYYY-MM-DD) or falsy.
  const globalStart = useMemo(() => (globalStartDate ? dayjs(globalStartDate, 'YYYY-MM-DD') : null), [globalStartDate]);
  const globalEnd = useMemo(() => (globalEndDate ? dayjs(globalEndDate, 'YYYY-MM-DD') : null), [globalEndDate]);
  // Expect incoming deliveryData to be an array of { date, delivered, undelivered }
  const normalizedData = useMemo(() => (Array.isArray(deliveryData) ? deliveryData : []), [deliveryData]);
  const chunkSize = Math.max(1, Number(deliveryWindowSize) || 1);
  const chartData = useMemo(() => {
    if (!isMobileView) return normalizedData;
    if (!normalizedData.length) return normalizedData;
    const total = normalizedData.length;
    const maxPage = Math.max(0, Math.ceil(total / chunkSize) - 1);
    const safePage = Math.min(Math.max(0, Number(deliveryPage) || 0), maxPage);
    const end = Math.min(total, total - (safePage * chunkSize)) || total;
    const start = Math.max(0, end - chunkSize);
    return normalizedData.slice(start, end);
  }, [chunkSize, deliveryPage, isMobileView, normalizedData]);
  const hasData = chartData.length > 0;

  const deliveredColor = '#4ade80';
  const undeliveredColor = '#f87171';

  // Pretty month names for X-axis label formatting
  const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const formatTick = useCallback((raw) => {
    if (!raw || typeof raw !== 'string') return raw;

    // Expecting:
    // daily:   YYYY-MM-DD
    // monthly: YYYY-MM
    // yearly:  YYYY
    if (deliveryInterval === 'daily') {
      const [y, m, d] = raw.split('-');
      if (m && d) {
        const mi = Math.max(1, Math.min(12, parseInt(m, 10))) - 1;
        return `${MONTH[mi]} ${d}`;
      }
      return raw;
    }
    if (deliveryInterval === 'monthly') {
      const [y, m] = raw.split('-');
      if (y && m) {
        const mi = Math.max(1, Math.min(12, parseInt(m, 10))) - 1;
        return `${MONTH[mi]} ${y}`;
      }
      return raw;
    }
    // yearly
    return raw;
  }, [deliveryInterval]);

  // If there are many bars, tilt labels for readability. Thresholds tuned so
  // initial window sizes (daily=20) still show labels by default.
  const manyTicks = chartData.length > (deliveryInterval === 'daily' ? 24 : 12);
  const xAngle = manyTicks ? -35 : 0;
  const xAnchor = manyTicks ? 'end' : 'middle';

  // Show numeric labels above bars when the chart is not too dense
  const showBarLabels = !manyTicks;

  const loadOlderDisabled = loadingDelivery || !canLoadOlder;
  const resetDisabled = loadingDelivery || !hasExtendedRange;

  const displayRangeLabel = useMemo(() => {
    if (!isMobileView || !chartData.length) return rangeLabel;
    const first = chartData[0]?.date ? String(chartData[0].date) : '';
    const last = chartData[chartData.length - 1]?.date ? String(chartData[chartData.length - 1].date) : '';
    if (!first) return rangeLabel;
    const formattedStart = formatTick(first);
    const formattedEnd = last ? formatTick(last) : formattedStart;
    return formattedStart === formattedEnd ? formattedStart : `${formattedStart} - ${formattedEnd}`;
  }, [chartData, formatTick, isMobileView, rangeLabel]);

  // Decide which interval options should be presented and whether they should be disabled
  // based on the global date range (parent dashboard). Rules:
  // - If global range covers a single day => monthly + yearly disabled
  // - If global range is within the same month => monthly should not appear, yearly disabled
  // - Otherwise show all intervals enabled
  const { allowedDeliveryOptions, effectiveDeliveryInterval } = useMemo(() => {
    const allowed = [];
    const hasGlobal = globalStart && globalEnd && globalStart.isValid() && globalEnd.isValid();
    const sameDay = hasGlobal && globalStart.isSame(globalEnd, 'day');
    const sameMonth = hasGlobal && globalStart.isSame(globalEnd, 'month');

    // Always include daily
    allowed.push({ value: 'daily', label: 'Daily', disabled: false });

    if (sameDay) {
      // If single day: include monthly & yearly but disabled so user is aware they exist
      allowed.push({ value: 'monthly', label: 'Monthly', disabled: true });
      allowed.push({ value: 'yearly', label: 'Yearly', disabled: true });
    } else if (sameMonth) {
      // If the global range spans only one month: do not show monthly (it's redundant)
      // but include yearly as disabled (too coarse)
      // (daily already present)
      allowed.push({ value: 'yearly', label: 'Yearly', disabled: true });
    } else {
      // multi-month range: show all enabled
      allowed.push({ value: 'monthly', label: 'Monthly', disabled: false });
      allowed.push({ value: 'yearly', label: 'Yearly', disabled: false });
    }

    // Determine a safe interval to use if current value is missing/disabled
    let safe = deliveryInterval || 'daily';
    const current = allowed.find(o => o.value === deliveryInterval);
    if (!current || current.disabled) safe = 'daily';
    return { allowedDeliveryOptions: allowed, effectiveDeliveryInterval: safe };
  }, [globalStart, globalEnd, deliveryInterval]);

  // If the parent's current selection is invalid for the current global range, switch to a safe interval
  useEffect(() => {
    if (!deliveryInterval) return;
    const current = allowedDeliveryOptions.find(o => o.value === deliveryInterval);
    if (!current || current.disabled) {
      setDeliveryInterval(effectiveDeliveryInterval);
    }
  }, [allowedDeliveryOptions, deliveryInterval, effectiveDeliveryInterval, setDeliveryInterval]);

  return (
    <>
      <Card
        title="Delivery Analytics"
        className="col-span-full h-[500px]"
        exportRef={deliveryChartRef}
        exportId="delivery"
      >
        <div className="flex flex-col h-full max-h-full overflow-hidden relative">
          {loadingDelivery && <ChartLoading message="Loading delivery data..." />}

          {/* Controls */}
          <div
            data-export-exclude
            className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 w-full md:w-auto">
              <div className="w-full max-w-[180px] sm:w-36">
                <DropdownCustom
                  value={deliveryInterval}
                  onChange={(e) => setDeliveryInterval(e.target.value)}
                  label="Graph Interval"
                  variant="default"
                  size="xs"
                  options={allowedDeliveryOptions}
                />
              </div>

              {/* Legend: delivered vs undelivered for clarity */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm" style={{ background: deliveredColor }} />
                  <span className="text-gray-600">Delivered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm" style={{ background: undeliveredColor }} />
                  <span className="text-gray-600">Undelivered</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 text-left sm:text-right w-full md:w-auto">
              {displayRangeLabel && (
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                  {displayRangeLabel}
                </span>
              )}
              {windowLabel && (
                <span className="text-[11px] text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {windowLabel}
                </span>
              )}
              {hasExtendedRange && (
                <button
                  type="button"
                  onClick={onResetRange}
                  disabled={resetDisabled}
                  className="px-3 py-1.5 text-xs font-semibold text-green-700 border border-green-200 rounded-md bg-white hover:bg-green-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Latest
                </button>
              )}
              {Number.isFinite(deliveryTotalPages) && (
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap sm:mx-3">
                  Page {Math.max(1, (Number(deliveryPage || 0) + 1))} of {deliveryTotalPages}
                </span>
              )}
              <button
                type="button"
                onClick={onLoadOlder}
                disabled={loadOlderDisabled}
                className="px-3 py-1.5 text-xs font-semibold text-green-700 border border-green-200 rounded-md bg-white hover:bg-green-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Older Range
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="delivery">
            {!hasData ? (
              <ChartNoData
                message="No data for the selected filters."
                hint="TRY CHANGING STATUS OR INTERVAL."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: manyTicks ? 30 : 16 }}
                  barCategoryGap={chartData.length <= 5 ? 12 : 8}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />

                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={xAngle}
                    textAnchor={xAnchor}
                    tickFormatter={formatTick}
                  />

                  {(() => {
                    const max = chartData.reduce(
                      (m, p) => Math.max(m, Number(p.delivered) || 0, Number(p.undelivered) || 0),
                      0
                    );

                    if (max <= 0) {
                      return (
                        <YAxis
                          domain={[0, 1]}
                          tick={{ fontSize: 12, fill: 'transparent' }}
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          width={0}
                        />
                      );
                    }
                    const padded = Math.ceil(max * 1.2);
                    return (
                      <YAxis
                        domain={[0, padded]}
                        tick={{ fontSize: 12, fill: 'transparent' }}
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        width={0}
                      />
                    );
                  })()}

                  <Tooltip
                    cursor={false}
                    labelFormatter={(v) => formatTick(v)}
                    formatter={(value, name) => [Number(value).toLocaleString(), name === 'undelivered' ? 'Undelivered' : 'Delivered']}
                  />

                  <Bar
                    dataKey="delivered"
                    name="delivered"
                    fill={deliveredColor}
                    radius={[4, 4, 0, 0]}
                    background={{ fill: '#F8FAFC' }}
                  >
                    {showBarLabels && (
                      <LabelList
                        dataKey="delivered"
                        position="top"
                        formatter={(v) => (v == null ? '0' : String(v))}
                        style={{ fontSize: 12, fill: '#0f172a', fontWeight: 600 }}
                      />
                    )}
                  </Bar>

                  <Bar
                    dataKey="undelivered"
                    name="undelivered"
                    fill={undeliveredColor}
                    radius={[4, 4, 0, 0]}
                    background={{ fill: '#F8FAFC' }}
                  >
                    {showBarLabels && (
                      <LabelList
                        dataKey="undelivered"
                        position="top"
                        formatter={(v) => (v == null ? '0' : String(v))}
                        style={{ fontSize: 12, fill: '#0f172a', fontWeight: 600 }}
                      />
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}

export default Delivery;
