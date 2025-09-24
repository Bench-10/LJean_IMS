import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { currencyFormat } from '../utils/formatCurrency.js';
import { NavLink, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const KPIBlock = ({ color, title, value, note }) => (
  <div className="bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">
    <div className={`absolute left-0 top-0 bottom-0 w-2 ${color}`} />
    <h3 className="text-[13px] font-semibold text-gray-700">{title}</h3>
    <p className="text-[clamp(22px,3vw,32px)] font-bold mt-1 leading-tight">{value}</p>
    {note && <p className="text-[11px] text-green-600 font-medium mt-1">{note}</p>}
  </div>
);

export default function OwnerAnalytics(){
  const [kpis, setKpis] = useState({ total_sales:0, total_investment:0, total_profit:0, inventory_count: 0 });
  const [salesPerformance, setSalesPerformance] = useState([]);
  const [interval, setInterval] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // KPI range handling (same as branch analytics)
  const todayISO = new Date().toISOString().slice(0,10);
  const monthStartISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const [rangeMode, setRangeMode] = useState('preset');
  const [preset, setPreset] = useState('current_month');
  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);



  useEffect(()=>{ fetchAll(); }, [interval, preset, rangeMode, startDate, endDate]);
  async function fetchAll(){
    try {

      setLoading(true); setError(null);

      // Resolve KPI date range 
      let start_date = startDate;
      let end_date = endDate;
      if(rangeMode === 'preset') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let s = today;
        if(preset === 'current_day') s = today;
        else if(preset === 'current_week') {
          const dow = today.getDay();
          const offset = (dow === 0 ? -6 : 1 - dow);
          s = new Date(today); s.setDate(s.getDate() + offset);
        } else if(preset === 'current_month') s = new Date(today.getFullYear(), today.getMonth(), 1);
        else if(preset === 'current_year') s = new Date(today.getFullYear(), 0, 1);
        start_date = s.toISOString().slice(0,10);
        end_date = today.toISOString().slice(0,10);
      }

      const range = '6m';
      const [kpiRes, salesRes] = await Promise.all([
        axios.get('http://localhost:3000/api/analytics/kpis', { params: { start_date, end_date } }),
        axios.get('http://localhost:3000/api/analytics/sales-performance', { params: { interval, range } })
      ]);

      setKpis(kpiRes.data);
      setSalesPerformance(salesRes.data && salesRes.data.length ? salesRes.data : []);
    } catch(e){

      setError('Failed to load KPIs');
    } finally { setLoading(false); }
    
  }


  const formatPeriod = (p) => {
    if(!p) return '';
    const iso = String(p).slice(0,10);
    const d = new Date(iso + 'T00:00:00');
    if(isNaN(d)) return p;

    if(interval==='daily') return d.toLocaleDateString('en-US',{ month:'short', day:'numeric'});

    if(interval==='weekly') return d.toLocaleDateString('en-US',{ month:'short', day:'numeric'});

    return d.toLocaleDateString('en-US',{ month:'short'});

  };

  return (
    <div className='ml-[220px] px-6 py-8 h-full flex flex-col gap-6 bg-[#eef2ee] min-h-0 overflow-hidden'>
      <div className="flex items-center gap-4 flex-wrap">

        <h1 className="text-lg font-semibold text-gray-700">Overall Performance (All Branches)</h1>

        <div className='flex items-center gap-3 ml-auto'>
          {/* KPI Range Controls */}
          <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1">
            <label className="text-[11px] text-gray-600 font-semibold">Mode</label>
            <select value={rangeMode} onChange={e=>setRangeMode(e.target.value)} className="text-xs border rounded px-1 py-1">
              <option value="preset">Preset</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {rangeMode === 'preset' && (
            <select value={preset} onChange={e=>setPreset(e.target.value)} className="border px-2 py-2 rounded text-xs bg-white h-10 min-w-[140px]">
              <option value="current_day">Current Day</option>
              <option value="current_week">Current Week</option>
              <option value="current_month">Current Month</option>
              <option value="current_year">Current Year</option>
            </select>
          )}
          {rangeMode === 'custom' && (
            <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1">
              <div className="flex flex-col text-[10px] text-gray-500">
                <span>Start</span>
                <input type="date" value={startDate} max={endDate} onChange={e=>setStartDate(e.target.value)} className="text-xs border rounded px-1 py-1" />
              </div>
              <div className="flex flex-col text-[10px] text-gray-500">
                <span>End</span>
                <input type="date" value={endDate} min={startDate} max={todayISO} onChange={e=>setEndDate(e.target.value)} className="text-xs border rounded px-1 py-1" />
              </div>
            </div>
          )}
          
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading KPIs...</div>}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid gap-5 w-full grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 flex-shrink-0">
            <KPIBlock color="bg-green-400" title="Total Sales" value={currencyFormat(kpis.total_sales)}  />

        
            <KPIBlock color="bg-yellow-400" title="Total Investment" value={currencyFormat(kpis.total_investment)} />


            <KPIBlock color="bg-blue-400" title="Total Profit" value={currencyFormat(kpis.total_sales > kpis.total_investment ? kpis.total_profit : 0)}/>
            <KPIBlock color="bg-purple-400" title="Inventory Items" value={Number(kpis.inventory_count).toLocaleString()} note="Distinct products across scope" />
          </div>
          
        </>
      )}
    </div>
  );
}
