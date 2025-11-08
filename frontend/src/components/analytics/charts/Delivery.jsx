import React, { useMemo, useCallback } from 'react';
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
  windowLabel = ''
}) {
  const normalizedData = useMemo(
    () => (Array.isArray(deliveryData) ? deliveryData : []),
    [deliveryData]
  );
  const hasData = normalizedData.length > 0;

  const barColor = deliveryStatus === 'undelivered' ? '#f87171' : '#4ade80';

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
  const manyTicks = normalizedData.length > (deliveryInterval === 'daily' ? 24 : 12);
  const xAngle = manyTicks ? -35 : 0;
  const xAnchor = manyTicks ? 'end' : 'middle';

  // Show numeric labels above bars when the chart is not too dense
  const showBarLabels = !manyTicks;

  const loadOlderDisabled = loadingDelivery || !canLoadOlder;
  const resetDisabled = loadingDelivery || !hasExtendedRange;

  return (
    <>
      <Card title="Delivery Analytics" className="col-span-full h-[500px]" exportRef={deliveryChartRef}>
        <div className="flex flex-col h-full max-h-full overflow-hidden relative">
          {loadingDelivery && <ChartLoading message="Loading delivery data..." />}

          {/* Controls */}
          <div
            data-export-exclude
            className="flex flex-wrap items-end justify-between gap-3 mb-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-36">
                <DropdownCustom
                  value={deliveryStatus}
                  onChange={(e) => setDeliveryStatus(e.target.value)}
                  label="Status"
                  variant="default"
                  size="xs"
                  options={[
                    { value: 'delivered', label: 'Delivered' },
                    { value: 'undelivered', label: 'Undelivered' },
                  ]}
                />
              </div>

              <div className="w-36">
                <DropdownCustom
                  value={deliveryInterval}
                  onChange={(e) => setDeliveryInterval(e.target.value)}
                  label="Interval"
                  variant="default"
                  size="xs"
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly' },
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 text-right">
              {rangeLabel && (
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                  {rangeLabel}
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
                  data={normalizedData}
                  margin={{ top: 10, right: 10, left: 10, bottom: manyTicks ? 30 : 16 }}
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
                    const max = normalizedData.reduce(
                      (m, p) => Math.max(m, Number(p.number_of_deliveries) || 0),
                      0
                    );

                    if (max <= 0) {
                      return (
                        <YAxis
                          domain={[0, 1]}
                          tick={{ fontSize: 12 }}
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                        />
                      );
                    }
                    const padded = Math.ceil(max * 1.2);
                    return (
                      <YAxis
                        domain={[0, padded]}
                        tick={{ fontSize: 12 }}
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                      />
                    );
                  })()}

                  <Tooltip
                    labelFormatter={(v) => formatTick(v)}
                    formatter={(value) => [
                      Number(value).toLocaleString(),
                      deliveryStatus === 'undelivered' ? 'Undelivered' : 'Delivered',
                    ]}
                  />

                  <Bar
                    dataKey="number_of_deliveries"
                    fill={barColor}
                    radius={[4, 4, 0, 0]}
                    background={{ fill: '#F8FAFC' }}
                  >
                    {showBarLabels && (
                      <LabelList
                        dataKey="number_of_deliveries"
                        position="top"
                        formatter={(v) => (v == null ? '0' : String(v))}
                        style={{ fontSize: 14, fill: '#0f172a', fontWeight: 600 }}
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
