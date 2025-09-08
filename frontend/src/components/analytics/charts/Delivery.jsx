import React from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend, Cell } from 'recharts';

function Delivery({Card, deliveryData}) {
  return (
    <>
      <Card title={"Delivery"} className="col-span-full h-full">
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
      </Card>
    </>
  )
}

export default Delivery