import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {currencyFormat} from '../../utils/formatCurrency.js';
import { NavLink } from "react-router-dom";
import TopProducts from './charts/TopProducts.jsx';
import Delivery from './charts/Delivery.jsx';
import { TbTruckDelivery } from "react-icons/tb";
import { FaRegMoneyBillAlt } from "react-icons/fa";



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
  const [deliveryData, setDeliveryData] = useState([]);


  //SWITCH TO DIFFERENT TYPE OF ANALYTICS
  const [currentCharts, setCurrentCharts] = useState("sale");


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
      const [sales, restock, levels, top, cat, kpi, delivery] = await Promise.all([
        axios.get(`${base}/sales-performance`, { params }),
        axios.get(`${base}/restock-trends`, { params }),
        axios.get(`${base}/inventory-levels`, { params }),
        axios.get(`${base}/top-products`, { params: { ...params, limit: 7 } }),
        axios.get(`${base}/category-distribution`, { params: { branch_id: branchId } }),
        axios.get(`${base}/kpis`, { params: { branch_id: branchId, category_id: categoryFilter || undefined } }),
        axios.get(`${base}/delivery`, { params: { ...(branchId ? { branch_id: branchId } : {}), format: interval } })
      ]);

      setSalesPerformance(sales.data);
      setRestockTrends(restock.data);
      setInventoryLevels(levels.data);
      setTopProducts(top.data);
      setCategoryDist(cat.data);
      setKpis(kpi.data);
  // Ensure counts are numbers for the chart
  setDeliveryData(delivery.data.map(d => ({ ...d, number_of_deliveries: Number(d.number_of_deliveries) })));
      
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
    return p; 
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

      <div className="flex flex-wrap items-center justify-between" >

        {(!branchId) &&

            <NavLink to="/branches" className={`relative py-1 px-2 border-2 rounded-md border-gray-600 transition-all cursor-pointer hover:text-white hover:bg-gray-600`} >

              <span className="text-sm">
                  View Branch Anlytics
              </span>
            </NavLink>
        
        }

        <div className={`flex flex-wrap gap-3 items-center ${!branchId ? 'justify-between' : ''}`}>

          <CategorySelect categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onCategoryNameChange={setCategoryName} />

          <select value={interval} onChange={e=>setInterval(e.target.value)} className="border px-3 py-2 rounded text-sm bg-white h-10 min-w-[130px]">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>


        {/*LETS USER SWITCH TO DIFFERENT CHARTS */}
        <div 
          className="flex border-2 rounded-full bg-gray-50 shadow-sm overflow-hidden transition-all duration-200"
          role="tablist"
        >
          <button
            className={`flex items-center gap-2 py-2 px-7 font-semibold text-sm
              ${currentCharts === "sale"
                ? "bg-green-800 text-white scale-105 shadow-md"
                : "text-green-800 hover:bg-green-100 "
              } rounded-l-full`}
            aria-selected={currentCharts === "sale"}
            onClick={() => setCurrentCharts("sale")}
            tabIndex={0}
          >
            <FaRegMoneyBillAlt />
            Sales
          </button>
          <button
            className={`flex items-center gap-2 py-2 px-7 font-semibold text-sm 
              ${currentCharts === "delivery"
                ? "bg-green-800 text-white scale-105 shadow-md"
                : "text-green-800 hover:bg-green-100 "
              } rounded-r-full`}
            aria-selected={currentCharts === "delivery"}
            onClick={() => setCurrentCharts("delivery")}
            tabIndex={0}
          >
            <TbTruckDelivery />
            Delivery
          </button>
        </div>
        
        
      </div>

      {/* KPI CARDS*/}
      <div className="grid gap-5 w-full grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            <div className="bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">
              
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-400" />

              <h3 className="text-[13px] font-semibold text-gray-700">Total Sales</h3>

              <p className="text-[clamp(22px,3vw,32px)] font-bold mt-1 leading-tight">
                {currencyFormat(kpis.total_sales)}

              </p>


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
  
      {/*CHARTS CONTAINAER*/}
      <div className="grid grid-cols-12 gap-5 flex-1 min-h-0 overflow-hidden">
       

       { currentCharts === "sale" && 

        (
          <TopProducts 
            topProducts={topProducts} 
            salesPerformance={salesPerformance} 
            formatPeriod={formatPeriod} 
            restockTrends={restockTrends} 
            Card={Card} 
            categoryName={categoryName}

          />
        )

       }


       { currentCharts === "delivery" && 

        (
          <Delivery
            Card={Card}
            deliveryData={deliveryData}
          />
        )
       
       }
 

      </div>


    </div>

  );

}

