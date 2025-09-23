import React, { useEffect } from 'react';
import { currencyFormat } from '../../../utils/formatCurrency';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, AreaChart, Area, Legend, Cell } from 'recharts';
import ChartNoData from '../../common/ChartNoData.jsx';

function TopProducts({topProducts, salesPerformance, formatPeriod, restockTrends, Card, categoryName, salesInterval, setSalesInterval, restockInterval, setRestockInterval }) {
  console.log('📊 TopProducts component render:', { 
    salesPerformanceLength: salesPerformance?.length,
    salesPerformance: salesPerformance,  // Show all data
    sampleItem: salesPerformance?.[0],  // Show structure of first item
    salesInterval,
    topProductsLength: topProducts?.length,
    topProducts: topProducts
  });
  
  console.log('🎨 TopProducts component mounted and rendering charts');
  
  useEffect(() => {
    console.log('📐 TopProducts useEffect - checking container dimensions');
    const containers = document.querySelectorAll('[data-chart-container]');
    containers.forEach((container, index) => {
      const rect = container.getBoundingClientRect();
      console.log(`Container ${index}:`, {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0
      });
    });
  }, []);
  
  return (
    <>
        <Card title={categoryName} className="col-span-12 lg:col-span-4 h-[360px] md:h-[420px] lg:h-[480px] xl:h-[560px]">
            <div className="flex-1 min-h-0 h-full max-h-full overflow-hidden" data-chart-container="top-products">
            {(!topProducts || topProducts.length === 0) ? (
              <ChartNoData message="No top products for the selected filters." />
            ) : (
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
            )}
            </div>

            </Card>

            <Card title="Sales Performance" className="col-span-12 lg:col-span-8 h-[360px] md:h-[420px] lg:h-[480px] xl:h-[560px]">
            <div className="flex flex-col h-full gap-6 max-h-full overflow-hidden">
                {/* Sales Performance Filter */}
                <div className="flex justify-end">
                    <select value={salesInterval} onChange={e=>setSalesInterval(e.target.value)} className="text-xs border rounded px-2 py-1 bg-white">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>

                <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="sales-performance">

                    {(!salesPerformance || salesPerformance.length === 0) ? (
                        <ChartNoData
                          message="No sales performance data for the selected filters."
                          hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY."
                        />
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">

                        <LineChart data={salesPerformance} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                            <CartesianGrid stroke="#f1f5f9" />

                            <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={formatPeriod} />

                            {(() => {
                                const maxSales = salesPerformance.reduce((m,p)=> Math.max(m, Number(p.sales_amount)||0), 0);
                                const maxUnits = salesPerformance.reduce((m,p)=> Math.max(m, Number(p.units_sold)||0), 0);
                                const overallMax = Math.max(maxSales, maxUnits);
                                
                                if (overallMax <= 0) return <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />;
                                
                                const target = Math.ceil(overallMax * 1.15); 
                                const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                                const padded = Math.ceil(target / magnitude) * magnitude;
                                
                                return <YAxis type="number" domain={[0, padded]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />;
                            })()}

                         
                            <Tooltip labelFormatter={formatPeriod} />

                            <Line type="monotone" dataKey="sales_amount" name="Sales" stroke="#0f766e" strokeWidth={2} dot={false} />


                        </LineChart>

                    </ResponsiveContainer>
                    )}

                </div>

            <div>
                {/* Demand Forecasting Filter */}
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[11px] tracking-wide font-semibold text-gray-500 uppercase">Demand Forecasting (Units Sold)</h3>
                    
                </div>

                {(!salesPerformance || salesPerformance.length === 0) ? (
                        <ChartNoData
                          message="No units sold data for the selected filters."
                          hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY."
                        />
                ) : (
                <div className="h-52 max-h-52 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesPerformance} margin={{ top: 0, right: 15, left: 0, bottom: 5 }}>
                        <defs>

                        <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">

                            <stop offset="5%" stopColor="#0891b2" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>


                        </linearGradient>


                        </defs>
                        
                        <CartesianGrid stroke="#f1f5f9" />
                        
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={formatPeriod} />
                        
                        {(() => {
                            const max = salesPerformance.reduce((m,p)=> Math.max(m, Number(p.units_sold)||0), 0);
                            
                            if (max <= 0) return <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />;
                            
                            const target = Math.ceil(max * 1.15);
                            const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                            const padded = Math.ceil(target / magnitude) * magnitude;
                            
                            return <YAxis tick={{ fontSize: 10 }} domain={[0, padded]} />;
                        })()}
                        
                        <Tooltip 
                            labelFormatter={formatPeriod} 
                            formatter={(value) => [`${value} units`, 'Units Sold']}
                        />
                        
                        <Area type="monotone" dataKey="units_sold" stroke="#0891b2" fillOpacity={1} fill="url(#colorUnits)" />

                    </AreaChart>

                </ResponsiveContainer>

                </div>
                )}

            </div>

            </div>
    
        </Card>
    
    </>
  )
}

export default TopProducts