import React, { useMemo } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';

function Delivery({Card, deliveryData, deliveryInterval, setDeliveryInterval, deliveryStatus, setDeliveryStatus, loadingDelivery, deliveryChartRef}) {
  const normalizedData = useMemo(
    () => (Array.isArray(deliveryData) ? deliveryData : []),
    [deliveryData]
  );
  const hasData = normalizedData.length > 0;

  const barColor = deliveryStatus === 'undelivered' ? '#f87171' : '#4ade80';

  return (
    <>
      <Card title={"Delivery Analytics"} className="col-span-full h-[500px]" exportRef={deliveryChartRef}>
          <div className="flex flex-col h-full max-h-full overflow-hidden relative">
            {loadingDelivery && <ChartLoading message="Loading delivery data..." />}
            {/* Delivery Controls */}
            <div data-export-exclude className="flex items-center gap-2 justify-end mb-4 p-2 rounded-md">
              {/* Status selector */}
              <label className="text-[11px] text-gray-600 font-semibold">Status</label>
              <select
                value={deliveryStatus}
                onChange={e => setDeliveryStatus(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-white"
              >
                <option value="delivered">Delivered</option>
                <option value="undelivered">Undelivered</option>
              </select>

              {/* Interval selector */}
              <label className="text-[11px] text-gray-600 font-semibold">Interval</label>
              <select 
                value={deliveryInterval} 
                onChange={e => setDeliveryInterval(e.target.value)} 
                className="text-xs border rounded px-2 py-1 bg-white"
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
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
                    margin={{ top: 10, right: 5, left: 5, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0}  textAnchor="end" />

                    {(() => {
                      const max = normalizedData.reduce((m,p) => Math.max(m, Number(p.number_of_deliveries)|| 0 ), 0);

                      if (max === 0 ) return <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />

                      const padded = Math.ceil(max * 1.2); 

                      return <YAxis  domain={[0, padded]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />

                    })()}
                    
                    <Tooltip formatter={(value) => [value, deliveryStatus === 'undelivered' ? 'Undelivered' : 'Delivered']} />
                    <Bar dataKey="number_of_deliveries" fill={barColor} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
      </Card>
    </>
  )
}

export default Delivery
