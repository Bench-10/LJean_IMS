import React, { useEffect, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);
import api from '../../utils/api.js';
import {currencyFormat} from '../../utils/formatCurrency.js';
import { NavLink } from "react-router-dom";
import TopProducts from './charts/TopProducts.jsx';
import Delivery from './charts/Delivery.jsx';
import BranchPerformance from './charts/BranchPerformance.jsx';
import BranchTimeline from './charts/BranchTimeline.jsx';
import { TbTruckDelivery } from "react-icons/tb";
import { FaRegMoneyBillAlt, FaLongArrowAltUp, FaLongArrowAltDown, FaShoppingCart, FaPiggyBank, FaWallet } from "react-icons/fa";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import { AiFillProduct } from "react-icons/ai";
import { useAuth } from '../../authentication/Authentication.jsx';
import ChartLoading from '../common/ChartLoading.jsx';



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
      try { const res = await api.get(`/api/categories`); setList(res.data); } catch(e){ console.error(e);} }
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
  const { user } = useAuth();

  // ROLE CHECK: ONLY OWNER SHOULD SEE BRANCH PERFORMANCE OPTION
  const isOwner = user?.role?.some(role => ['Owner'].includes(role));

  const [salesPerformance, setSalesPerformance] = useState({ history: [], forecast: [], series: [] });
  const [restockTrends, setRestockTrends] = useState([]);
  const [inventoryLevels, setInventoryLevels] = useState([]);
  const [categoryDist, setCategoryDist] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  
  // Loading states for each chart
  const [loadingSalesPerformance, setLoadingSalesPerformance] = useState(false);
  const [loadingTopProducts, setLoadingTopProducts] = useState(false);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [loadingKPIs, setLoadingKPIs] = useState(false);
  const [loadingBranchPerformance, setLoadingBranchPerformance] = useState(false);
  
  // Graph intervals (separate from KPI/Top Products)
  const [salesInterval, setSalesInterval] = useState('monthly');
  const [restockInterval, setRestockInterval] = useState('monthly');
  
  // Delivery specific controls
  const [deliveryInterval, setDeliveryInterval] = useState('monthly');
  const [deliveryStatus, setDeliveryStatus] = useState('delivered');
  // Use dayjs to avoid timezone shifts
  const todayISO = dayjs().format('YYYY-MM-DD');
  const monthStartISO = dayjs().startOf('month').format('YYYY-MM-DD');
  const [deliveryRangeMode, setDeliveryRangeMode] = useState('preset');
  const [deliveryPreset, setDeliveryPreset] = useState('current_month');
  const [deliveryStartDate, setDeliveryStartDate] = useState(monthStartISO);
  const [deliveryEndDate, setDeliveryEndDate] = useState(todayISO);
  
  // KPI & Top Products range handling
  const [rangeMode, setRangeMode] = useState('preset'); 
  const [preset, setPreset] = useState('current_month');
  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [categoryFilter, setCategoryFilter] = useState(''); 
  const [productIdFilter, setProductIdFilter] = useState('')
  const [categories, setCategories] = useState([]);
  const [kpis, setKpis] = useState({ total_sales:0, total_investment:0, total_profit:0, prev_total_sales:0, prev_total_investment:0, prev_total_profit:0, inventory_count: 0});
  const [categoryName, setCategoryName] = useState('All Products');
  const [deliveryData, setDeliveryData] = useState([]);

  // Compute date range display for preset mode
  const dateRangeDisplay = useMemo(() => {
    if (rangeMode !== 'preset') return null;
    const today = dayjs().startOf('day');
    let s = today;
    if (preset === 'current_day') {
      s = today;
    } else if (preset === 'current_week') {
      s = today.isoWeekday(1).startOf('day');
    } else if (preset === 'current_month') {
      s = today.startOf('month');
    } else if (preset === 'current_year') {
      s = today.startOf('year');
    }
    const start = s.format('MMM DD, YYYY');
    const end = today.format('MMM DD, YYYY');
    return `${start} - ${end}`;
  }, [rangeMode, preset]);

  // Keep startDate/endDate in sync when using preset mode so children (e.g., BranchPerformance) get accurate ranges
  useEffect(() => {
    if (rangeMode !== 'preset') return;
    const today = dayjs().startOf('day');
    let s = today;
    if (preset === 'current_day') {
      s = today;
    } else if (preset === 'current_week') {
      s = today.isoWeekday(1).startOf('day');
    } else if (preset === 'current_month') {
      s = today.startOf('month');
    } else if (preset === 'current_year') {
      s = today.startOf('year');
    }
    const newStart = s.format('YYYY-MM-DD');
    const newEnd = today.format('YYYY-MM-DD');
    // Only update if changed to avoid unnecessary renders
    if (newStart !== startDate) setStartDate(newStart);
    if (newEnd !== endDate) setEndDate(newEnd);
  }, [rangeMode, preset]);

 
  const [currentCharts, setCurrentCharts] = useState(() => {
    // CHECK IF USER HAS OWNER ROLE
    if (user && !branchId && user.role && user.role.some(role => role === "Owner")) {
      return "branch";
    } else {
      return "sale";
    }
  });


  useEffect(()=>{ fetchAll();  console.log(salesPerformance);}, [branchId, salesInterval, restockInterval, categoryFilter, preset, rangeMode, startDate, endDate, deliveryInterval, deliveryStatus, productIdFilter]);
  const [allBranches, setAllBranches] = useState([]);
  useEffect(()=>{ if(canSelectBranch || (!branchId && isOwner)) loadBranches(); }, [canSelectBranch, branchId, isOwner]);
  async function loadBranches(){
    try { const res = await api.get(`/api/analytics/branches`); setAllBranches(res.data); } catch(e){ console.error(e);} }

  async function fetchAll(){
    const base = `/api/analytics`;
    
    // Set loading states
    setLoadingSalesPerformance(true);
    setLoadingTopProducts(true);
    setLoadingDelivery(true);
    setLoadingKPIs(true);
    if (!branchId && isOwner) setLoadingBranchPerformance(true);
    
    let start_date = startDate;
    let end_date = endDate;
    if(rangeMode === 'preset') {
      const today = dayjs().startOf('day');
      let s = today;
      if (preset === 'current_day') {
        s = today;
      } else if (preset === 'current_week') {
       
        s = today.isoWeekday(1).startOf('day');
      } else if (preset === 'current_month') {
        s = today.startOf('month');
      } else if (preset === 'current_year') {
        s = today.startOf('year');
      }
      start_date = s.format('YYYY-MM-DD');
      end_date = today.format('YYYY-MM-DD');
    }

    // Sales performance uses salesInterval
  const paramsSales = { interval: salesInterval };
    if (branchId) paramsSales.branch_id = branchId;
    if (categoryFilter) paramsSales.category_id = categoryFilter;
    if (productIdFilter) paramsSales.product_id = productIdFilter;

    // Restock trends uses restockInterval  
    const paramsRestock = { interval: restockInterval };
    if (branchId) paramsRestock.branch_id = branchId;

    // Inventory levels don't need interval
    const paramsLevels = {};
    if (branchId) paramsLevels.branch_id = branchId;

    const paramsTop = {
      branch_id: branchId,
      category_id: categoryFilter || undefined,
      start_date,
      end_date,
      limit: 50,
      interval: salesInterval,
      include_forecast: true
    };

    const paramsKPI = { 
      branch_id: branchId, 
      category_id: categoryFilter || undefined, 
      product_id: productIdFilter || undefined,
      start_date, 
      end_date,
      preset: rangeMode === 'preset' ? preset : 'custom'
    };
    
    // Delivery uses its own interval only - no date range filtering
    const paramsDelivery = { 
      ...(branchId ? { branch_id: branchId } : {}), 
      format: deliveryInterval,
      status: deliveryStatus
    };

    try {
      const [sales, restock, levels, top, cat, kpi, delivery] = await Promise.all([
        api.get(`${base}/sales-performance`, { params: paramsSales }),
        api.get(`${base}/restock-trends`, { params: paramsRestock }),
        api.get(`${base}/inventory-levels`, { params: paramsLevels }),
        api.get(`${base}/top-products`, { params: paramsTop }),
        api.get(`${base}/category-distribution`, { params: { branch_id: branchId } }),
        api.get(`${base}/kpis`, { params: paramsKPI }),
        api.get(`${base}/delivery`, { params: paramsDelivery })
      ]);

      const normalizedSales = Array.isArray(sales.data)
        ? {
            history: sales.data,
            forecast: [],
            series: sales.data
          }
        : {
            history: sales.data?.history ?? [],
            forecast: sales.data?.forecast ?? [],
            series: sales.data?.series ?? sales.data?.history ?? []
          };

      setSalesPerformance(normalizedSales);
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
    } finally {
      // Clear loading states
      setLoadingSalesPerformance(false);
      setLoadingTopProducts(false);
      setLoadingDelivery(false);
      setLoadingKPIs(false);
      setLoadingBranchPerformance(false);
    }
  }

  const formatPeriod = (raw) => {
    if(raw == null) return '';
    let p = raw;
    
    if(p instanceof Date) {
      if(isNaN(p)) return '';
      return formatByInterval(p, salesInterval);
    }
    
    p = String(p);
   
    const isoMatch = p.match(/^(\d{4}-\d{2}-\d{2})(T.*)?$/);
    if(isoMatch) {
      // USE DAYJS TO AVOID TIMEZONE ISSUES
      const d = dayjs(isoMatch[1], 'YYYY-MM-DD');
      if(d.isValid()) return formatByInterval(d.toDate(), salesInterval);
    }
   
    const ymMatch = p.match(/^(\d{4})-(\d{2})$/);
    if(ymMatch) {
      const d = dayjs(`${ymMatch[1]}-${ymMatch[2]}-01`, 'YYYY-MM-DD');
      if(d.isValid()) return d.format('MMM');
    }
    return p; 
  };

  const formatByInterval = (d, intervalType = salesInterval) => {
    if(intervalType === 'daily') return d.toLocaleDateString('en-US', { month:'short', day:'numeric' }); // Aug 5
    if(intervalType === 'weekly') {
     
      const day = new Date(d);
    
      const dow = day.getDay(); 
      const offset = (dow === 0 ? -6 : 1 - dow); 
      day.setDate(day.getDate() + offset);
      return day.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    }
   
    return d.toLocaleDateString('en-US', { month:'short' });

  };


  //COMPARES PREVIOUS VALUES FROM THE CURRENT
  const compareValues = (current, previous) => {

    if (previous === 0 && current !== 0) return (<span className='flex items-center text-green-500 italic'><FaLongArrowAltUp />  {Number(current.toFixed(2)).toLocaleString()}% Increase!</span>)

    if (previous !== 0 && current === 0) return (<span className='flex items-center text-red-500 italic'><FaLongArrowAltDown />  {Number(previous.toFixed(2)).toLocaleString()}% Decrease!</span>)

    if (previous === current) return "No change";
    


    const percentageChange = ((current - previous) / previous) * 100;

    if (percentageChange > 0) {

      return (<span className='flex items-center text-green-500 italic'><FaLongArrowAltUp />  {Number(percentageChange.toFixed(2)).toLocaleString()}% Increase!</span>)

    } else if (percentageChange < 0) {

      return (<span className='flex items-center text-red-500 italic'><FaLongArrowAltDown />  {Number(percentageChange.toFixed(2)).toLocaleString()}% Decrease!</span>)

    } 
  }

  
  const latestDate = inventoryLevels.length>0 ? inventoryLevels[inventoryLevels.length-1].date : null;
  const latestSnapshot = latestDate ? inventoryLevels.filter(r=> r.date=== latestDate) : [];

  return (
  <div className="flex flex-col gap-5 flex-1 min-h-0">

      <div className="flex flex-wrap items-center justify-between" >

        {(!branchId) &&

            <NavLink to="/branches" className={`relative py-2 px-4 border-2 bg-white font-medium rounded-md text-green-800 border-gray-200 transition-all cursor-pointer hover:bg-green-100`} >

              <span className="text-sm">
                  View Branch Anlytics
              </span>
            </NavLink>
        
        }

        <div className={`flex flex-wrap gap-3 items-center ${!branchId ? 'justify-between' : ''}`}>
          <CategorySelect categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onCategoryNameChange={setCategoryName} />
          
          {/* KPI & Top Products Range Controls */}
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


        {/*LETS USER SWITCH TO DIFFERENT CHARTS (ONLY APPEAR IF USER HAS BRANCH_ID OR IS OWNER WITH NO BRANCH_ID)*/}
        { (branchId || (!branchId && isOwner)) &&

          <div 
          className="flex border-2 rounded-full bg-gray-50 shadow-sm overflow-hidden transition-all duration-200"
          role="tablist"
          >
            {/* BRANCH PERFORMANCE BUTTON - OWNER ONLY AND NO BRANCH_ID */}
            {!branchId && isOwner && (
              <button
                className={`flex items-center gap-2 py-2 px-7 font-semibold text-sm 
                  ${currentCharts === "branch"
                    ? "bg-green-800 text-white scale-105 shadow-md"
                    : "text-green-800 hover:bg-green-100 "
                  }`}
                aria-selected={currentCharts === "branch"}
                onClick={() => {setCurrentCharts("branch"); setProductIdFilter('');} }
                tabIndex={0}
              >
                <HiOutlineBuildingOffice2 />
                Branch
              </button>
            )}
            <button
              className={`flex items-center gap-2 py-2 px-7 font-semibold text-sm
                ${currentCharts === "sale"
                  ? "bg-green-800 text-white scale-105 shadow-md"
                  : "text-green-800 hover:bg-green-100 "
                } ${!branchId && isOwner ? 'rounded-r-full' : ''}`}
              aria-selected={currentCharts === "sale"}
              onClick={() => setCurrentCharts("sale")}
              tabIndex={0}
            >
              <FaRegMoneyBillAlt />
              Sales
            </button>
            {branchId && (
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
            )}
            
          </div>

        }
        
        
        
      </div> 

      {/* KPI CARDS*/}
  <div className="grid gap-5 w-full grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 relative">
            
            <div className="flex items-center w-full bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">
              {loadingKPIs && <ChartLoading message='Loading total sales' type='kpi' /> }
              <div className='mr-5 ml-1'>
                

                <FaShoppingCart className='text-4xl text-green-500'/>
                
               
              </div>

              <div>
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-400" />

                <div className="flex w-full items-center mb-1">
                  <h3 className="text-[13px] font-semibold text-gray-700 mr-2">Total Sales</h3>
                  {dateRangeDisplay && (
                    <span className="text-[9px] text-gray-600">{dateRangeDisplay}</span>
                  )}
                </div>
                <p className="text-[clamp(18px,2vw,26px)] font-bold mt-1 leading-tight w-full text-left">
                  {currencyFormat(kpis.total_sales)}
                </p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">
                  {compareValues(kpis.total_sales, kpis.prev_total_sales)}
                </p>
              </div>
              
              
              

            </div>


            <div className="flex items-center w-full bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">

              {loadingKPIs && <ChartLoading message='Loading total investments' type='kpi' /> }

              <div className='mr-5 ml-1'>
                
                <FaPiggyBank className='text-4xl text-yellow-500'/>
                
               
              </div>


              <div>
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-yellow-400" />
                <div className="flex w-full items-center mb-1">
                  <h3 className="text-[13px] font-semibold text-gray-700 mr-2">Total Investment</h3>
                  {dateRangeDisplay && (
                    <span className="text-[9px] text-gray-600">{dateRangeDisplay}</span>
                  )}
                </div>
                <p className="text-[clamp(18px,2vw,26px)] font-bold mt-1 leading-tight w-full text-left">{currencyFormat(kpis.total_investment)}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">
                  {compareValues(kpis.total_investment, kpis.prev_total_investment)}
                </p>
              </div>
              
              

            </div>


            <div className="flex items-center bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">

              {loadingKPIs && <ChartLoading message='Loading total profit' type='kpi' /> }

              <div className='mr-5 ml-1'>
                
                <FaWallet className='text-4xl text-blue-500'/>
                
               
              </div>


              <div>
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-400" />
                <div className="flex w-full items-center mb-1">
                  <h3 className="text-[13px] font-semibold text-gray-700 mr-2">Total Profit</h3>
                  {dateRangeDisplay && (
                    <span className="text-[9px] text-gray-600">{dateRangeDisplay}</span>
                  )}
                </div>
                <p className="text-[clamp(18px,2vw,26px)] font-bold mt-1 leading-tight w-full text-left">{kpis.total_sales >  kpis.total_investment ? currencyFormat(kpis.total_profit) : currencyFormat(0)}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">
                  {compareValues(kpis.total_profit, kpis.prev_total_profit)}
                </p>
              </div>

              
              

            </div>

            {/* INVENTORY COUNT KPI */}
            <div className="flex items-center bg-white rounded-md shadow-sm border border-gray-200 p-5 h-28 relative overflow-hidden">

              {loadingKPIs && <ChartLoading message='Loading produc count' type='kpi' /> }

              <div className='mr-5 ml-1'>
               
                <AiFillProduct  className='text-4xl text-purple-500'/>
              </div>

              <div>
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-purple-400" />  
                <div className="flex w-full items-center mb-1">
                  <h3 className="text-[13px] font-semibold text-gray-700 mr-2">Inventory Items</h3>
                  {dateRangeDisplay && (
                    <span className="text-[9px] text-gray-600">{dateRangeDisplay}</span>
                  )}
                </div>
                <p className="text-[clamp(18px,2vw,26px)] font-bold mt-1 leading-tight w-full text-left">{Number(kpis.inventory_count).toLocaleString()}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">Total distinct products</p>
              </div>

            </div>

      </div>
  
      {/*CHARTS CONTAINAER*/}
  <div className="grid grid-cols-12 gap-5 flex-1 min-h-0 max-h-screen overflow-hidden">
       

       { currentCharts === "sale" && 

        (
          <TopProducts 
            topProducts={topProducts} 
            salesPerformance={salesPerformance} 
            formatPeriod={formatPeriod} 
            restockTrends={restockTrends} 
            Card={Card} 
            categoryName={categoryName}
            salesInterval={salesInterval}
            setSalesInterval={setSalesInterval}
            restockInterval={restockInterval}
            setRestockInterval={setRestockInterval}
            setProductIdFilter={setProductIdFilter}
            productIdFilter={productIdFilter}
            loadingSalesPerformance={loadingSalesPerformance}
            loadingTopProducts={loadingTopProducts}
            dateRangeDisplay={dateRangeDisplay}
          />
        )

       }


       { currentCharts === "delivery" && 

        (
          <Delivery
            Card={Card}
            deliveryData={deliveryData}
            deliveryInterval={deliveryInterval}
            setDeliveryInterval={setDeliveryInterval}
            deliveryStatus={deliveryStatus}
            setDeliveryStatus={setDeliveryStatus}
            loadingDelivery={loadingDelivery}
          />
        )
       
       }

       {/* BRANCH PERFORMANCE CHARTS - OWNER ONLY AND NO BRANCH_ID */}
       { currentCharts === "branch" && !branchId && isOwner && 

        (
          <>
            <BranchPerformance
              Card={Card}
              rangeMode={rangeMode}
              preset={preset}
              startDate={startDate}
              endDate={endDate}
              todayISO={todayISO}
              categoryFilter={categoryFilter}
              loadingBranchPerformance={loadingBranchPerformance}
            />
            
            <BranchTimeline
              Card={Card}
              categoryFilter={categoryFilter}
              allBranches={allBranches}
              loadingBranchTimeline={loadingBranchPerformance}
            />
          </>
        )
       
       }
 

      </div>


    </div>

  );

}

