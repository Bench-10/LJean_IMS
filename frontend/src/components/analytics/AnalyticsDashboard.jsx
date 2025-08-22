import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, AreaChart, Area, Legend, Cell } from 'recharts';
import {currencyFormat} from '../../utils/formatCurrency.js';

/* Layout wrapper to mimic existing style (cards, spacing) */
const Card = ({ title, children, className='' }) => (
  <div className={`flex flex-col border border-gray-200 rounded-md bg-white p-4 shadow-sm ${className}`}>
    {title && <h2 className="text-[11px] tracking-wide font-semibold text-gray-500 uppercase mb-2">{title}</h2>}
    <div className="flex-1">{children}</div>
  </div>
);



const CategorySelect = ({ categoryFilter, setCategoryFilter, onCategoryNameChange }) => {
  const [list, setList] = useState([]);
  useEffect(()=>{
    async function load(){
      try { const res = await axios.get('http://localhost:3000/api/categories'); setList(res.data); } catch(e){ console.error(e);} }
    load();
  },[]);
  return (
    <select value={categoryFilter} onChange={e=>{ const val = e.target.value; setCategoryFilter(val); if(!val) onCategoryNameChange('All Products'); else { const found = list.find(c=> String(c.category_id)===val); onCategoryNameChange(found? found.category_name : 'All Products'); } }} className="border px-2 py-1 rounded text-sm bg-white h-10 min-w-[140px]">
      <option value="">All Categories</option>
      {list.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
    </select>
  );
};

export default function AnalyticsDashboard({ branchId, canSelectBranch=false }) {
  const [salesPerformance, setSalesPerformance] = useState([]);
  const [restockTrends, setRestockTrends] = useState([]);
  const [inventoryLevels, setInventoryLevels] = useState([]);
  const [categoryDist, setCategoryDist] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [interval, setInterval] = useState('monthly');
  const [categoryFilter, setCategoryFilter] = useState(''); 
  const [categories, setCategories] = useState([]);
  const [kpis, setKpis] = useState({ total_sales:0, total_investment:0, total_profit:0 });
  const [categoryName, setCategoryName] = useState('All Products');

  useEffect(()=>{ fetchAll(); }, [branchId, interval, categoryFilter]);
  const [allBranches, setAllBranches] = useState([]);
  useEffect(()=>{ if(canSelectBranch) loadBranches(); }, [canSelectBranch]);
  async function loadBranches(){
    try { const res = await axios.get('http://localhost:3000/api/analytics/branches'); setAllBranches(res.data); } catch(e){ console.error(e);} }

  async function fetchAll(){
    const base = 'http://localhost:3000/api/analytics';
  const params = { interval};
  if (branchId) params.branch_id = branchId;
    if (categoryFilter) params.category_id = categoryFilter;
    try {
      const [sales, restock, levels, top, cat, kpi] = await Promise.all([
        axios.get(`${base}/sales-performance`, { params }),
        axios.get(`${base}/restock-trends`, { params }),
        axios.get(`${base}/inventory-levels`, { params }),
        axios.get(`${base}/top-products`, { params: { ...params, limit: 7 } }),
  axios.get(`${base}/category-distribution`, { params: { branch_id: branchId } }),
  axios.get(`${base}/kpis`, { params: { branch_id: branchId, category_id: categoryFilter || undefined } })
      ]);
      setSalesPerformance(sales.data);
      setRestockTrends(restock.data);
      setInventoryLevels(levels.data);
      setTopProducts(top.data);
      setCategoryDist(cat.data);
      setKpis(kpi.data);
      
      if (cat.data && cat.data.length && categories.length === 0) {
        
      }
    } catch(e){
      console.error('Analytics fetch error', e);
    }
  }

  
  const formatPeriod = (raw) => {
    if(raw == null) return '';
    let p = raw;
    
    if(p instanceof Date) {
      if(isNaN(p)) return '';
      return formatByInterval(p);
    }
    
    p = String(p);
   
    const isoMatch = p.match(/^(\d{4}-\d{2}-\d{2})(T.*)?$/);
    if(isoMatch) {
      const d = new Date(isoMatch[1] + 'T00:00:00');
      if(!isNaN(d)) return formatByInterval(d);
    }
   
    const ymMatch = p.match(/^(\d{4})-(\d{2})$/);
    if(ymMatch) {
      const d = new Date(Number(ymMatch[1]), Number(ymMatch[2]) - 1, 1);
      if(!isNaN(d)) return d.toLocaleDateString('en-US', { month:'short' });
    }
    return p; // fallback
  };

  const formatByInterval = (d) => {
    if(interval === 'daily') return d.toLocaleDateString('en-US', { month:'short', day:'numeric' }); // Aug 5
    if(interval === 'weekly') {
     
      const day = new Date(d);
    
      const dow = day.getDay(); 
      const offset = (dow === 0 ? -6 : 1 - dow); 
      day.setDate(day.getDate() + offset);
      return day.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    }
   
    return d.toLocaleDateString('en-US', { month:'short' });
  };

  
  const latestDate = inventoryLevels.length>0 ? inventoryLevels[inventoryLevels.length-1].date : null;
  const latestSnapshot = latestDate ? inventoryLevels.filter(r=> r.date=== latestDate) : [];

  return (
  <div className="flex flex-col gap-5 flex-1 min-h-0">

      <div className="flex flex-wrap gap-3 items-center -mt-4">
        {canSelectBranch && (
          <select value={branchId || ''} onChange={e=>window.location.reload()} className="border px-3 py-2 rounded text-sm bg-white h-10 min-w-[160px]">
            <option value="">All Branches</option>
            {allBranches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
        )}
  <CategorySelect categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onCategoryNameChange={setCategoryName} />
        <select value={interval} onChange={e=>setInterval(e.target.value)} className="border px-3 py-2 rounded text-sm bg-white h-10 min-w-[130px]">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* KPI CARDS*/}
  <div className="grid gap-5 w-full grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-400" />
          <h3 className="text-[13px] font-semibold text-gray-700">Total Sales</h3>
          <p className="text-[clamp(22px,3vw,32px)] font-bold mt-1 leading-tight">{currencyFormat(kpis.total_sales)}</p>
          <p className="text-[11px] text-green-600 font-medium mt-1">↑ 5.3% vs last month</p>
        </div>
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-yellow-400" />
          <h3 className="text-[13px] font-semibold text-gray-700">Total Investment</h3>
          <p className="text-[clamp(22px,3vw,32px)] font-bold mt-1 leading-tight">{currencyFormat(kpis.total_investment)}</p>
          <p className="text-[11px] text-green-600 font-medium mt-1">↑ 5.3% vs last month</p>
        </div>
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-400" />
          <h3 className="text-[13px] font-semibold text-gray-700">Total Profit</h3>
          <p className="text-[clamp(22px,3vw,32px)] font-bold mt-1 leading-tight">{kpis.total_sales >  kpis.total_investment ? currencyFormat(kpis.total_profit): currencyFormat(0)}</p>
          <p className="text-[11px] text-green-600 font-medium mt-1">↑ 5.3% vs last month</p>
        </div>
      </div>

  <div className="grid grid-cols-12 gap-5 flex-1 min-h-0 overflow-hidden">
  <Card title={categoryName} className="col-span-4 h-full">
          <div className="flex-1 min-h-0 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} barSize={14} margin={{ top: 10, right: 5, left: 5, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
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
      </div>
    </div>
  );
}
