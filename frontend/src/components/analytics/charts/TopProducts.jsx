import React from 'react';
import { currencyFormat } from '../../../utils/formatCurrency';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, AreaChart, Area, Legend, Cell } from 'recharts';

function TopProducts({topProducts, salesPerformance, formatPeriod, restockTrends, Card, categoryName }) {
  return (
    <>
    
    <Card title={categoryName} className="col-span-4 h-full">
            <div className="flex-1 min-h-0 h-full">
            

            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} barSize={14} margin={{ top: 10, right: 5, left: 5, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                {(() => {
                    const max = topProducts.reduce((m,p)=> Math.max(m, Number(p.sales_amount)||0), 0);
                    const padded = max === 0 ? 1 : Math.ceil((max * 1.1)/100)*100; 
                    return <XAxis type="number" domain={[0, padded]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />;
                })()}
                <YAxis dataKey="product_name" type="category" tick={{ fontSize: 14 }} width={110} axisLine={false} tickLine={false} />

                
                <Tooltip formatter={(v)=>currencyFormat(v)} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="sales_amount" radius={[0,4,4,0]}>
                    {topProducts.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={idx < 3 ? '#16a34a' : '#3bb3b3'} />
                    ))}
                </Bar>

                </BarChart>

            </ResponsiveContainer>

            </div>

            </Card>

            <Card title="Sales Performance" className="col-span-8 h-full">
            <div className="flex flex-col h-full gap-6">

            <div className="flex-1 min-h-0">

            <ResponsiveContainer width="100%" height="100%">

                <LineChart data={salesPerformance} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="#f1f5f9" />

                <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={formatPeriod} />

                <YAxis tick={{ fontSize: 10 }} />

                <Tooltip labelFormatter={formatPeriod} />

                <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 10 }} />

                <Line type="monotone" dataKey="sales_amount" name="Sales" stroke="#0f766e" strokeWidth={2} dot={false} />

                <Line type="monotone" dataKey="units_sold" name="Units" stroke="#0891b2" strokeWidth={2} dot={false} />

                </LineChart>

            </ResponsiveContainer>

            </div>

            <div>

                <h3 className="text-[11px] tracking-wide font-semibold text-gray-500 uppercase mb-2">Demand Forecasting (Future Slot)</h3>
                <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={restockTrends} margin={{ top: 0, right: 15, left: 0, bottom: 5 }}>
                    <defs>

                    <linearGradient id="colorAdd" x1="0" y1="0" x2="0" y2="1">

                        <stop offset="5%" stopColor="#3bb3b3" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3bb3b3" stopOpacity={0}/>


                    </linearGradient>


                    </defs>
                    
                    <CartesianGrid stroke="#f1f5f9" />
                    
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={formatPeriod} />
                    
                    <YAxis tick={{ fontSize: 10 }} />
                    
                    <Tooltip labelFormatter={formatPeriod} />
                    
                    <Area type="monotone" dataKey="total_added" stroke="#3bb3b3" fillOpacity={1} fill="url(#colorAdd)" />

                </AreaChart>

                </ResponsiveContainer>

                </div>

            </div>

            </div>
    
        </Card>
    
    </>
  )
}

export default TopProducts