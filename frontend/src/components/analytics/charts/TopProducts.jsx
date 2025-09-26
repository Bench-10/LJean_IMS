import React, { useEffect } from 'react';
import { currencyFormat } from '../../../utils/formatCurrency';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Area, Legend, Cell, ReferenceLine, ComposedChart } from 'recharts';
import ChartNoData from '../../common/ChartNoData.jsx';

function TopProducts({topProducts, salesPerformance, formatPeriod, restockTrends, Card, categoryName, salesInterval, setSalesInterval, restockInterval, setRestockInterval, setProductIdFilter, productIdFilter }) {

  
  useEffect(() => {
    console.log(salesPerformance);
    
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

  // SET FILTER BY PRODUCT ID
  const handleClick = (data) => {
    setProductIdFilter(data.product_id)
  };

  // CLEAR PRODUCT FILTER
  const clearProductFilter = () => {
    setProductIdFilter('');
  };

  // GET SELECTED PRODUCT NAME
  const selectedProductName = productIdFilter ? 
    topProducts?.find(p => p.product_id === parseInt(productIdFilter))?.product_name : null;

  
  const VISIBLE_ROWS = 7;      

  const BAR_SIZE = 30;        

  const ROW_GAP = 44;      

  const MARGIN_TOP = 10;           
  const MARGIN_BOTTOM = 10;        
  const itemsCount = Array.isArray(topProducts) ? topProducts.length : 0;
  
  const visibleHeight = (VISIBLE_ROWS * BAR_SIZE) + ((VISIBLE_ROWS - 1) * ROW_GAP) + MARGIN_TOP + MARGIN_BOTTOM; 

  const totalHeight = (itemsCount * BAR_SIZE) + (Math.max(itemsCount - 1, 0) * ROW_GAP) + MARGIN_TOP + MARGIN_BOTTOM;

  const normalizedPerformance = Array.isArray(salesPerformance)
    ? {
        history: salesPerformance,
        forecast: [],
        series: salesPerformance.map(item => ({ ...item, is_forecast: false }))
      }
    : (salesPerformance ?? { history: [], forecast: [], series: [] });

  const combinedSeries = Array.isArray(normalizedPerformance.series) && normalizedPerformance.series.length
    ? normalizedPerformance.series
    : (Array.isArray(normalizedPerformance.history)
        ? normalizedPerformance.history.map(item => ({ ...item, is_forecast: false }))
        : []);

  const actualSeries = combinedSeries
    .filter(item => item && item.is_forecast !== true)
    .map(item => ({
      ...item,
      sales_amount: Number(item.sales_amount ?? item.amount ?? 0),
      units_sold: Number(item.units_sold ?? item.value ?? 0)
    }));

  const forecastSeries = combinedSeries
    .filter(item => item && item.is_forecast === true)
    .map(item => ({
      ...item,
      sales_amount: Number(item.sales_amount ?? item.amount ?? 0),
      units_sold: Number(item.units_sold ?? item.value ?? item.forecast ?? 0)
    }));

  const hasActualData = actualSeries.length > 0;
  const hasForecastData = forecastSeries.length > 0;

  const lastActualPeriod = hasActualData ? actualSeries[actualSeries.length - 1]?.period : null;

  const forecastChartData = combinedSeries.map(item => {
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
  
  return (
    <>
        <Card title={selectedProductName ? `${categoryName} - ${selectedProductName}` : categoryName} className=" relative col-span-12 lg:col-span-4 h-[360px] md:h-[420px] lg:h-[480px] xl:h-[560px]">
            <div className="flex flex-col h-full">
              {selectedProductName && (
                <div className="absolute top-2 right-3 mb-2">
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
              {(!topProducts || topProducts.length === 0) ? (
                <ChartNoData message="No top products for the selected filters." />
              ) : (
                <ResponsiveContainer width="100%" height={totalHeight}>
                    <BarChart
                      data={topProducts}
                      margin={{ top: MARGIN_TOP, right: 5, left: 5, bottom: MARGIN_BOTTOM }}
                      layout="vertical"
                      barCategoryGap={`${ROW_GAP}px`}
                      barGap={0}
                    >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    {(() => {
                        const max = topProducts.reduce((m,p)=> Math.max(m, Number(p.sales_amount)||0), 0);
                        const padded = max === 0 ? 1 : Math.ceil((max * 1.1)/100)*100; 
                        return <XAxis type="number" domain={[0, padded]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />;
                    })()}
                    <YAxis dataKey="product_name" type="category" tick={{ fontSize: 14 }} width={110} axisLine={false} tickLine={false} />

                    
                    <Tooltip formatter={(v)=>currencyFormat(v)} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar
                      dataKey="sales_amount"
                      radius={[0,4,4,0]}
                      onClick={handleClick}
                      className='cursor-pointer'
                      barSize={BAR_SIZE}
                      background={{ fill: '#F8FAFC' }}
                    >
                        {topProducts.map((entry, idx) => {
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
                    </Bar>

                    </BarChart>
                </ResponsiveContainer>
            )}
              </div>
            </div>

            </Card>

            <Card title={selectedProductName ? `Sales Performance - ${selectedProductName}` : "Sales Performance"} className="col-span-12 lg:col-span-8 h-[360px] md:h-[420px] lg:h-[480px] xl:h-[560px]">
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

          {(!hasActualData) ? (
            <ChartNoData
              message={selectedProductName ? `No sales performance data for ${selectedProductName}.` : "No sales performance data for the selected filters."}
              hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY."
            />
          ) : (
          <ResponsiveContainer width="100%" height="100%">

            <LineChart data={actualSeries} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#f1f5f9" />

              <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={formatPeriod} />

              {(() => {
                const maxSales = actualSeries.reduce((m,p)=> Math.max(m, Number(p.sales_amount)||0), 0);
                const maxUnits = actualSeries.reduce((m,p)=> Math.max(m, Number(p.units_sold)||0), 0);
                const overallMax = Math.max(maxSales, maxUnits);
                                
                if (overallMax <= 0) return <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />;
                                
                const target = Math.ceil(overallMax * 1.15); 
                const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                const padded = Math.ceil(target / magnitude) * magnitude;
                                
                return <YAxis type="number" domain={[0, padded]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />;
              })()}

                         
              <Tooltip labelFormatter={formatPeriod} />

              <Area type="monotone" dataKey="sales_amount" stroke="none" fillOpacity={1} fill="url(#colorSales)" />
              <Line type="monotone" dataKey="sales_amount" name="Sales" stroke="#0f766e" strokeWidth={2} dot={false} />


            </LineChart>

          </ResponsiveContainer>
          )}

        </div>

            <div>
                {/* Demand Forecasting Filter */}
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[11px] tracking-wide font-semibold text-gray-500 uppercase">
                      {selectedProductName ? `Demand Forecasting - ${selectedProductName} (Units Sold)` : "Demand Forecasting (Units Sold)"}
                    </h3>
                    
                </div>

        {(!hasActualData && !hasForecastData) ? (
            <ChartNoData
              message={selectedProductName ? `No units sold data for ${selectedProductName}.` : "No units sold data for the selected filters."}
              hint="TRY ADJUSTING THE DATE RANGE OR CATEGORY."
            />
        ) : (
        <div className="h-52 max-h-52 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={forecastChartData} margin={{ top: 0, right: 15, left: 0, bottom: 5 }}>
            <defs>

            <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">

              <stop offset="5%" stopColor="#0891b2" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>


            </linearGradient>


            </defs>
                        
            <CartesianGrid stroke="#f1f5f9" />
                        
            <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={formatPeriod} />
                        
            {(() => {
              const maxActual = actualSeries.reduce((m,p)=> Math.max(m, Number(p.units_sold)||0), 0);
              const maxForecast = forecastSeries.reduce((m,p)=> Math.max(m, Number(p.units_sold)||0), 0);
              const max = Math.max(maxActual, maxForecast);
                            
              if (max <= 0) return <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />;
                            
              const target = Math.ceil(max * 1.15);
              const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
              const padded = Math.ceil(target / magnitude) * magnitude;
                            
              return <YAxis tick={{ fontSize: 10 }} domain={[0, padded]} />;
            })()}
                        
            <Tooltip 
              labelFormatter={formatPeriod} 
              formatter={(value, name, entry) => {
                if (value == null) return null;

                if (entry?.dataKey === 'confidence_base') {
                  return null;
                }

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

            {lastActualPeriod && (
              <ReferenceLine x={lastActualPeriod} stroke="#94a3b8" strokeDasharray="6 4" label={{ value: 'Forecast begins', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }} />
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
                        
            <Area type="monotone" dataKey="actual_units" name="Actual Units" stroke="#0891b2" fillOpacity={1} fill="url(#colorUnits)" connectNulls={false} />
            <Line type="monotone" dataKey="forecast_units" name="Forecast Units" stroke="#f97316" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />

          </ComposedChart>

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