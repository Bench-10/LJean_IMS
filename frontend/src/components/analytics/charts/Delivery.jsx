import React from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend, Cell } from 'recharts';
import ChartNoData from '../../common/ChartNoData.jsx';

function Delivery({Card, deliveryData, deliveryInterval, setDeliveryInterval, deliveryStatus, setDeliveryStatus}) {
  return (
    <>
      <Card title={"Delivery Analytics"} className="col-span-full h-[500px]">
          <div className="flex flex-col h-full max-h-full overflow-hidden">
            {/* Delivery Controls */}
            <div className="flex items-center gap-2 justify-end mb-4 p-2rounded-md">
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
              {(!deliveryData || deliveryData.length === 0) ? (
                <ChartNoData
                  message="No data for the selected filters."
                  hint="TRY CHANGING STATUS OR INTERVAL."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  
                  <BarChart
                    data={deliveryData}
                    margin={{ top: 10, right: 5, left: 5, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0}  textAnchor="end" />

                    {(() => {
                      const max = deliveryData.reduce((m,p) => Math.max(m, Number(p.number_of_deliveries)|| 0 ), 0);

                      if (max === 0 ) return <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />

                      const padded = Math.ceil(max * 1.2); 

                      return <YAxis  domain={[0, padded]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />

                    })()}
                    
                    <Tooltip />
                    <Bar dataKey="number_of_deliveries" fill="#4ade80" />
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