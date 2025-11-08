import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);

import api from '../../utils/api.js';
import { currencyFormat } from '../../utils/formatCurrency.js';
import { NavLink } from "react-router-dom";

import TopProducts from './charts/TopProducts.jsx';
import Delivery from './charts/Delivery.jsx';
import BranchPerformance from './charts/BranchPerformance.jsx';
import BranchTimeline from './charts/BranchTimeline.jsx';
import ExportReportDialog from '../dialogs/ExportReportDialog.jsx';

import { TbTruckDelivery } from "react-icons/tb";
import { FaRegMoneyBillAlt, FaLongArrowAltUp, FaLongArrowAltDown, FaShoppingCart, FaPiggyBank, FaWallet, FaFileExport } from "react-icons/fa";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import { AiFillProduct } from "react-icons/ai";

import { useAuth } from '../../authentication/Authentication.jsx';
import ChartLoading from '../common/ChartLoading.jsx';
import DropdownCustom from '../DropdownCustom.jsx';
import DatePickerCustom from '../DatePickerCustom.jsx';

const FETCH_DEBOUNCE_MS = 150;
const DELIVERY_WINDOW_SIZES = { daily: 20, monthly: 12, yearly: 5 };
const DELIVERY_META_DEFAULT = {
  min_bucket: null,
  max_bucket: null,
  min_reference: null,
  max_reference: null,
  step: 'day'
};

const normalizeDeliveryEntry = (entry) => {
  if (!entry || entry.date == null) return null;
  const dateKey = String(entry.date);
  if (!dateKey) return null;
  return {
    date: dateKey,
    number_of_deliveries: Number(entry.number_of_deliveries) || 0
  };
};

const fillDeliverySeries = (data, interval, startISO, endISO) => {
  const start = dayjs(startISO, 'YYYY-MM-DD');
  const end = dayjs(endISO, 'YYYY-MM-DD');
  const source = Array.isArray(data) ? data : [];

  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return source
      .map(normalizeDeliveryEntry)
      .filter(Boolean);
  }

  const mapped = new Map();
  source
    .map(normalizeDeliveryEntry)
    .filter(Boolean)
    .forEach((item) => {
      mapped.set(item.date, item);
    });

  const series = [];

  if (interval === 'yearly') {
    let cursor = start.startOf('year');
    const limit = end.startOf('year');
    while (cursor.isBefore(limit) || cursor.isSame(limit)) {
      const key = cursor.format('YYYY');
      const existing = mapped.get(key);
      series.push({ date: key, number_of_deliveries: existing?.number_of_deliveries ?? 0 });
      cursor = cursor.add(1, 'year');
    }
    return series;
  }

  if (interval === 'monthly') {
    let cursor = start.startOf('month');
    const limit = end.startOf('month');
    while (cursor.isBefore(limit) || cursor.isSame(limit)) {
      const key = cursor.format('YYYY-MM');
      const existing = mapped.get(key);
      series.push({ date: key, number_of_deliveries: existing?.number_of_deliveries ?? 0 });
      cursor = cursor.add(1, 'month');
    }
    return series;
  }

  let cursor = start.startOf('day');
  const limit = end.startOf('day');
  while (cursor.isBefore(limit) || cursor.isSame(limit)) {
    const key = cursor.format('YYYY-MM-DD');
    const existing = mapped.get(key);
    series.push({ date: key, number_of_deliveries: existing?.number_of_deliveries ?? 0 });
    cursor = cursor.add(1, 'day');
  }

  return series;
};

const mergeDeliverySeries = (older, current) => {
  const merged = new Map();

  (Array.isArray(older) ? older : [])
    .map(normalizeDeliveryEntry)
    .filter(Boolean)
    .forEach((item) => {
      merged.set(item.date, item);
    });

  (Array.isArray(current) ? current : [])
    .map(normalizeDeliveryEntry)
    .filter(Boolean)
    .forEach((item) => {
      merged.set(item.date, item);
    });

  return Array.from(merged.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);
};

/* ---------- Small utility card ---------- */
const Card = ({ title, children, className = '', exportRef, bodyClassName = '' }) => {
  const bodyClasses = ['flex-1', 'min-h-0', bodyClassName].filter(Boolean).join(' ');
  return (
    <div ref={exportRef} className={`flex flex-col border border-gray-200 rounded-md bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="text-[11px] tracking-wide font-semibold text-gray-500 uppercase mb-2">{title}</h2>}
      <div className={bodyClasses}>{children}</div>
    </div>
  );
};

/* ---------- Category select that also exposes the chosen name ---------- */
const CategorySelect = ({ categoryFilter, setCategoryFilter, onCategoryNameChange }) => {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function load() {
      try { const res = await api.get(`/api/categories`); setList(res.data); } catch (e) { console.error(e); }
    }
    load();
  }, []);
  const options = [{ value: '', label: 'All Categories' }, ...list.map(c => ({ value: String(c.category_id), label: c.category_name }))];
  return (
    <div className="min-w-[180px] w-full sm:w-auto">
      <DropdownCustom
        label="Category"
        value={categoryFilter}
        onChange={e => {
          const val = e.target.value;
          setCategoryFilter(val);
          if (!val) onCategoryNameChange('All Products');
          else {
            const found = list.find(c => String(c.category_id) === val);
            onCategoryNameChange(found ? found.category_name : 'All Products');
          }
        }}
        options={options}
        variant="floating"
      />
    </div>
  );
};


/* ---------- Responsive KPI tile ---------- */
function KPI({ loading, icon: Icon, iconClass, accentClass, title, value, sub, dateRangeDisplay }) {
  return (
    <div className="h-full bg-white rounded-md shadow-sm border border-gray-200 p-4 sm:p-5 relative overflow-hidden">
      {loading && <ChartLoading message={title} type="kpi" />}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 sm:w-2 ${accentClass}`} />
      
      <div className="grid grid-cols-[auto,1fr] items-start gap-3 sm:gap-4">
        <div className="place-self-start">
          <Icon className={`text-2xl sm:text-3xl ${iconClass}`} />
        </div>

        <div className="min-w-0">
          {/* Title + Date: allow wrapping; no truncate on the date */}
          <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 min-w-0">
            <h3 className="text-[14px] sm:text-[18px] font-semibold text-gray-700 whitespace-nowrap">
              {title}
            </h3>
            {dateRangeDisplay && (
              <span className="text-[10px] sm:text-[11px] text-gray-500 leading-none">
                {dateRangeDisplay}
              </span>
            )}
          </div>

          <p className="text-[clamp(18px,5vw,26px)] font-bold leading-tight truncate">
            {value}
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-1 truncate">
            {sub}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({ branchId, canSelectBranch = false }) {
  const { user } = useAuth();

  const isOwner = useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.role) ? user.role : user?.role ? [user.role] : [];
    return roles.includes('Owner');
  }, [user]);

  // Refs (export)
  const salesChartRef = useRef(null);
  const topProductsRef = useRef(null);
  const deliveryChartRef = useRef(null);
  const branchPerformanceRef = useRef(null);
  const revenueDistributionRef = useRef(null);
  const branchTimelineRef = useRef(null);
  const kpiRef = useRef(null);
  const deliveryRequestIdRef = useRef(0);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const [salesPerformance, setSalesPerformance] = useState({ history: [], forecast: [], series: [] });
  const [restockTrends, setRestockTrends] = useState([]);
  const [inventoryLevels, setInventoryLevels] = useState([]);
  const [categoryDist, setCategoryDist] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [branchTotals, setBranchTotals] = useState([]);
  const [branchError, setBranchError] = useState(null);
  const [loadingBranchPerformance, setLoadingBranchPerformance] = useState(false);
  const [restockSuggestions, setRestockSuggestions] = useState([]);
  const [loadingRestockSuggestions, setLoadingRestockSuggestions] = useState(false);

  const [loadingSalesPerformance, setLoadingSalesPerformance] = useState(false);
  const [loadingTopProducts, setLoadingTopProducts] = useState(false);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [loadingKPIs, setLoadingKPIs] = useState(false);

  const [salesInterval, setSalesInterval] = useState('monthly');
  const [restockInterval, setRestockInterval] = useState('monthly');

  const [deliveryInterval, setDeliveryInterval] = useState('monthly');
  const [deliveryStatus, setDeliveryStatus] = useState('delivered');

  const todayISO = dayjs().format('YYYY-MM-DD');
  const monthStartISO = dayjs().startOf('month').format('YYYY-MM-DD');

  const [rangeMode, setRangeMode] = useState('preset');
  const [preset, setPreset] = useState('current_month');
  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productIdFilter, setProductIdFilter] = useState('');
  const [kpis, setKpis] = useState({
    total_sales: 0, total_investment: 0, total_profit: 0,
    prev_total_sales: 0, prev_total_investment: 0, prev_total_profit: 0,
    inventory_count: 0
  });
  const [categoryName, setCategoryName] = useState('All Products');
  const [deliveryData, setDeliveryData] = useState([]);
  const [deliveryOldestCursor, setDeliveryOldestCursor] = useState(0);
  const [deliveryMeta, setDeliveryMeta] = useState(() => ({ ...DELIVERY_META_DEFAULT }));

  const dateRangeDisplay = useMemo(() => {
    if (rangeMode !== 'preset') return null;
    const today = dayjs().startOf('day');
    let s = today;
    if (preset === 'current_day') s = today;
    else if (preset === 'current_week') s = today.isoWeekday(1).startOf('day');
    else if (preset === 'current_month') s = today.startOf('month');
    else if (preset === 'current_year') s = today.startOf('year');
    const start = s.format('MMM DD, YYYY');
    const end = today.format('MMM DD, YYYY');
    return `${start} - ${end}`;
  }, [rangeMode, preset]);

  useEffect(() => {
    if (rangeMode !== 'preset') return;
    const today = dayjs().startOf('day');
    let s = today;
    if (preset === 'current_day') s = today;
    else if (preset === 'current_week') s = today.isoWeekday(1).startOf('day');
    else if (preset === 'current_month') s = today.startOf('month');
    else if (preset === 'current_year') s = today.startOf('year');
    const newStart = s.format('YYYY-MM-DD');
    const newEnd = today.format('YYYY-MM-DD');
    if (newStart !== startDate) setStartDate(newStart);
    if (newEnd !== endDate) setEndDate(newEnd);
  }, [rangeMode, preset]);

  const [currentCharts, setCurrentCharts] = useState(() => {
    if (user && !branchId && user.role && user.role.some(role => role === "Owner")) {
      return "branch";
    }
    return "sale";
  });

  const resolvedRange = useMemo(() => {
    if (rangeMode === 'preset') {
      const today = dayjs().startOf('day');
      let start = today;
      if (preset === 'current_day') start = today;
      else if (preset === 'current_week') start = today.isoWeekday(1).startOf('day');
      else if (preset === 'current_month') start = today.startOf('month');
      else if (preset === 'current_year') start = today.startOf('year');
      return { start_date: start.format('YYYY-MM-DD'), end_date: today.format('YYYY-MM-DD'), presetKey: preset };
    }
    return { start_date: startDate, end_date: endDate, presetKey: 'custom' };
  }, [rangeMode, preset, startDate, endDate]);

  const [allBranches, setAllBranches] = useState([]);

  useEffect(() => {
    setDeliveryData([]);
    setDeliveryOldestCursor(0);
    setDeliveryMeta({ ...DELIVERY_META_DEFAULT });
  }, [deliveryInterval, deliveryStatus, branchId]);

  const shouldLoadBranches = useMemo(
    () => canSelectBranch || (!branchId && isOwner),
    [canSelectBranch, branchId, isOwner]
  );

  const loadBranches = useCallback(async (signal) => {
    if (!shouldLoadBranches) {
      setAllBranches([]);
      return;
    }
    try {
      const res = await api.get(`/api/analytics/branches`, { signal });
      setAllBranches(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      if (e?.code === 'ERR_CANCELED') return;
      console.error('Branches fetch error', e);
    }
  }, [shouldLoadBranches]);

  const resetAnalyticsState = useCallback(() => {
    setSalesPerformance({ history: [], forecast: [], series: [] });
    setRestockTrends([]);
    setInventoryLevels([]);
    setTopProducts([]);
    setCategoryDist([]);
    setKpis({
      total_sales: 0, total_investment: 0, total_profit: 0,
      prev_total_sales: 0, prev_total_investment: 0, prev_total_profit: 0,
      inventory_count: 0
    });
    setDeliveryData([]);
    setDeliveryOldestCursor(0);
  setDeliveryMeta({ ...DELIVERY_META_DEFAULT });
    deliveryRequestIdRef.current = 0;
    setLoadingSalesPerformance(false);
    setLoadingTopProducts(false);
    setLoadingDelivery(false);
    setLoadingKPIs(false);
    setBranchTotals([]);
    setBranchError(null);
    setLoadingBranchPerformance(false);
    setRestockSuggestions([]);
    setLoadingRestockSuggestions(false);
  }, []);

  useEffect(() => {
    if (user) return;
    resetAnalyticsState();
  }, [resetAnalyticsState, user]);

  const fetchSalesPerformance = useCallback(async (signal) => {
    if (!user) return;
    const params = { interval: salesInterval };
    if (branchId) params.branch_id = branchId;
    if (categoryFilter) params.category_id = categoryFilter;
    if (productIdFilter) params.product_id = productIdFilter;
    setLoadingSalesPerformance(true);
    try {
      const response = await api.get(`/api/analytics/sales-performance`, { params, signal });
      const normalized = Array.isArray(response.data)
        ? { history: response.data, forecast: [], series: response.data }
        : {
          history: response.data?.history ?? [],
          forecast: response.data?.forecast ?? [],
          series: response.data?.series ?? response.data?.history ?? []
        };
      setSalesPerformance(normalized);
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Sales performance fetch error', e);
    } finally {
      setLoadingSalesPerformance(false);
    }
  }, [branchId, categoryFilter, productIdFilter, salesInterval, user]);

  const fetchTopProductsData = useCallback(async (signal) => {
    if (!user) return;

    const paramsTop = {
      branch_id: branchId || undefined,
      category_id: categoryFilter || undefined,
      start_date: resolvedRange.start_date,
      end_date: resolvedRange.end_date,
      limit: 50,
      interval: 'monthly',
      include_forecast: false
    };

    const paramsRestock = { interval: restockInterval };
    if (branchId) paramsRestock.branch_id = branchId;

    setLoadingTopProducts(true);
    try {
      const [topResult, restockResult] = await Promise.allSettled([
        api.get(`/api/analytics/top-products`, { params: paramsTop, signal }),
        api.get(`/api/analytics/restock-trends`, { params: paramsRestock, signal })
      ]);

      if (topResult.status === 'fulfilled') {
        setTopProducts(Array.isArray(topResult.value.data) ? topResult.value.data : []);
      } else if (topResult.reason?.code !== 'ERR_CANCELED') {
        console.error('Top products fetch error', topResult.reason);
        setTopProducts([]);
      }

      if (restockResult.status === 'fulfilled') {
        setRestockTrends(Array.isArray(restockResult.value.data) ? restockResult.value.data : []);
      } else if (restockResult.reason?.code !== 'ERR_CANCELED') {
        console.error('Restock trends fetch error', restockResult.reason);
        setRestockTrends([]);
      }
    } finally {
      setLoadingTopProducts(false);
    }
  }, [branchId, categoryFilter, resolvedRange, restockInterval, user]);

  const fetchRestockSuggestionsData = useCallback(async (signal) => {
    if (!user) return;

    const params = {
      branch_id: branchId || undefined,
      category_id: categoryFilter || undefined,
      start_date: resolvedRange.start_date,
      end_date: resolvedRange.end_date,
      limit: 50,
      interval: salesInterval,
      include_forecast: true
    };

    setLoadingRestockSuggestions(true);
    try {
      const response = await api.get(`/api/analytics/top-products`, { params, signal });
      setRestockSuggestions(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Restock suggestions fetch error', e);
      setRestockSuggestions([]);
    } finally {
      setLoadingRestockSuggestions(false);
    }
  }, [branchId, categoryFilter, resolvedRange, salesInterval, user]);

  const fetchInventoryLevels = useCallback(async (signal) => {
    if (!user) return;
    const params = {};
    if (branchId) params.branch_id = branchId;
    try {
      const response = await api.get(`/api/analytics/inventory-levels`, { params, signal });
      setInventoryLevels(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Inventory levels fetch error', e);
    }
  }, [branchId, user]);

  const fetchCategoryDistribution = useCallback(async (signal) => {
    if (!user) return;
    const params = branchId ? { branch_id: branchId } : {};
    try {
      const response = await api.get(`/api/analytics/category-distribution`, { params, signal });
      setCategoryDist(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Category distribution fetch error', e);
    }
  }, [branchId, user]);

  const fetchKPIsData = useCallback(async (signal) => {
    if (!user) return;
    const params = {
      start_date: resolvedRange.start_date,
      end_date: resolvedRange.end_date,
      preset: resolvedRange.presetKey
    };
    if (branchId) params.branch_id = branchId;
    if (categoryFilter) params.category_id = categoryFilter;
    if (productIdFilter) params.product_id = productIdFilter;

    setLoadingKPIs(true);
    try {
      const response = await api.get(`/api/analytics/kpis`, { params, signal });
      setKpis(response.data || {
        total_sales: 0,
        total_investment: 0,
        total_profit: 0,
        prev_total_sales: 0,
        prev_total_investment: 0,
        prev_total_profit: 0,
        inventory_count: 0
      });
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('KPIs fetch error', e);
      setKpis({
        total_sales: 0,
        total_investment: 0,
        total_profit: 0,
        prev_total_sales: 0,
        prev_total_investment: 0,
        prev_total_profit: 0,
        inventory_count: 0
      });
    } finally {
      setLoadingKPIs(false);
    }
  }, [branchId, categoryFilter, productIdFilter, resolvedRange, user]);

  const computeDeliveryRange = useCallback((cursor = 0) => {
    const windowSize = DELIVERY_WINDOW_SIZES[deliveryInterval] ?? DELIVERY_WINDOW_SIZES.daily;
    if (!windowSize) return null;

    const todayEnd = dayjs().endOf('day');

    if (deliveryInterval === 'yearly') {
      const endAnchor = dayjs().endOf('year').subtract(cursor * windowSize, 'year');
      const startAnchor = endAnchor.subtract(windowSize - 1, 'year');
      const end = cursor === 0 ? todayEnd : endAnchor.endOf('year');
      const start = startAnchor.startOf('year');
      return {
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        windowSize
      };
    }

    if (deliveryInterval === 'monthly') {
      const endAnchor = dayjs().endOf('month').subtract(cursor * windowSize, 'month');
      const startAnchor = endAnchor.subtract(windowSize - 1, 'month');
      const end = cursor === 0 ? todayEnd : endAnchor.endOf('month');
      const start = startAnchor.startOf('month');
      return {
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        windowSize
      };
    }

    const end = dayjs().endOf('day').subtract(cursor * windowSize, 'day');
    const start = end.subtract(windowSize - 1, 'day');
    return {
      start_date: start.format('YYYY-MM-DD'),
      end_date: end.format('YYYY-MM-DD'),
      windowSize
    };
  }, [deliveryInterval]);

  const loadDeliveryChunk = useCallback(async ({ cursor = 0, mode = 'replace', signal } = {}) => {
    if (!user) return;
    const range = computeDeliveryRange(cursor);
    if (!range) return;

    const params = {
      format: deliveryInterval,
      status: deliveryStatus,
      start_date: range.start_date,
      end_date: range.end_date
    };

    if (branchId) params.branch_id = branchId;

    const requestId = deliveryRequestIdRef.current + 1;
    deliveryRequestIdRef.current = requestId;
    setLoadingDelivery(true);

    try {
      const response = await api.get(`/api/analytics/delivery`, { params, signal });
      const payload = response.data;
      const rawRows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      const normalized = rawRows
        .map(normalizeDeliveryEntry)
        .filter(Boolean);

      const filled = fillDeliverySeries(normalized, deliveryInterval, range.start_date, range.end_date);

      setDeliveryData((prev) => (mode === 'prepend' ? mergeDeliverySeries(filled, prev) : filled));

      if (mode === 'prepend') {
        setDeliveryOldestCursor((prev) => Math.max(prev, cursor));
      } else {
        setDeliveryOldestCursor(cursor);
      }

      if (payload?.meta) {
        setDeliveryMeta({
          min_bucket: payload.meta.min_bucket ?? null,
          max_bucket: payload.meta.max_bucket ?? null,
          min_reference: payload.meta.min_reference ?? null,
          max_reference: payload.meta.max_reference ?? null,
          step: payload.meta.step ?? 'day'
        });
      } else if (mode === 'replace') {
        setDeliveryMeta({ ...DELIVERY_META_DEFAULT });
      }
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Delivery analytics fetch error', e);
      if (mode === 'replace') setDeliveryData([]);
    } finally {
      if (deliveryRequestIdRef.current === requestId) {
        setLoadingDelivery(false);
      }
    }
  }, [branchId, computeDeliveryRange, deliveryInterval, deliveryStatus, user]);

  const deliveryWindowSize = DELIVERY_WINDOW_SIZES[deliveryInterval] ?? DELIVERY_WINDOW_SIZES.daily;

  const deliveryWindowLabel = useMemo(() => {
    if (!deliveryWindowSize) return '';
    if (deliveryInterval === 'yearly') return `Shows ${deliveryWindowSize} years per request`;
    if (deliveryInterval === 'monthly') return `Shows ${deliveryWindowSize} months per request`;
    return `Shows ${deliveryWindowSize} days per request`;
  }, [deliveryInterval, deliveryWindowSize]);

  const deliveryRangeLabel = useMemo(() => {
    if (!deliveryData.length) return '';
    const first = deliveryData[0]?.date ? String(deliveryData[0].date) : '';
    const last = deliveryData[deliveryData.length - 1]?.date ? String(deliveryData[deliveryData.length - 1].date) : '';
    if (!first || !last) return '';

    if (deliveryInterval === 'yearly') {
      return first === last ? first : `${first} - ${last}`;
    }

    if (deliveryInterval === 'monthly') {
      const start = dayjs(`${first}-01`, 'YYYY-MM-DD');
      const end = dayjs(`${last}-01`, 'YYYY-MM-DD');
      if (!start.isValid() || !end.isValid()) return `${first} - ${last}`;
      const startStr = start.format('MMM YYYY');
      const endStr = end.format('MMM YYYY');
      return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
    }

    const start = dayjs(first, 'YYYY-MM-DD');
    const end = dayjs(last, 'YYYY-MM-DD');
    if (!start.isValid() || !end.isValid()) return `${first} - ${last}`;
    const startStr = start.format('MMM D, YYYY');
    const endStr = end.format('MMM D, YYYY');
    return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
  }, [deliveryData, deliveryInterval]);

  const canLoadOlder = useMemo(() => {
    if (loadingDelivery) return false;
    if (!deliveryMeta?.min_reference) return true;
    const nextRange = computeDeliveryRange(deliveryOldestCursor + 1);
    if (!nextRange) return false;
    const earliest = dayjs(deliveryMeta.min_reference, 'YYYY-MM-DD');
    if (!earliest.isValid()) return true;
    const nextEnd = dayjs(nextRange.end_date, 'YYYY-MM-DD');
    return nextEnd.isSame(earliest) || nextEnd.isAfter(earliest);
  }, [loadingDelivery, deliveryMeta, deliveryOldestCursor, computeDeliveryRange]);
  const hasExtendedDeliveryRange = deliveryOldestCursor > 0;

  const handleLoadOlder = useCallback(() => {
    if (loadingDelivery || !canLoadOlder) return;
    const nextCursor = deliveryOldestCursor + 1;
    loadDeliveryChunk({ cursor: nextCursor, mode: 'prepend' });
  }, [canLoadOlder, deliveryOldestCursor, loadDeliveryChunk, loadingDelivery]);

  const handleResetDeliveryRange = useCallback(() => {
    if (loadingDelivery || deliveryOldestCursor === 0) return;
    loadDeliveryChunk({ cursor: 0, mode: 'replace' });
  }, [deliveryOldestCursor, loadDeliveryChunk, loadingDelivery]);

  const fetchBranchPerformance = useCallback(async (signal) => {
    if (!user || !isOwner || branchId) {
      setBranchTotals([]);
      setBranchError(null);
      setLoadingBranchPerformance(false);
      return;
    }

    setLoadingBranchPerformance(true);
    setBranchError(null);

    try {
      const params = { start_date: resolvedRange.start_date, end_date: resolvedRange.end_date };
      if (categoryFilter) params.category_id = categoryFilter;

      const response = await api.get(`/api/analytics/branches-summary`, { params, signal });
      const data = Array.isArray(response.data) ? response.data : [];
      setBranchTotals(data);
    } catch (e) {
      if (e?.code === 'ERR_CANCELED') return;
      console.error('Branch performance fetch error', e);
      setBranchTotals([]);
      setBranchError('Failed to load branch performance data');
    } finally {
      setLoadingBranchPerformance(false);
    }
  }, [user, isOwner, branchId, resolvedRange, categoryFilter]);

  /* --------- Effects ---------- */
  useEffect(() => {
    if (!user) return;
    const c = new AbortController();
    const t = setTimeout(() => { fetchSalesPerformance(c.signal); }, FETCH_DEBOUNCE_MS);
    return () => { c.abort(); clearTimeout(t); };
  }, [fetchSalesPerformance, user]);

  useEffect(() => {
    if (!user) return;
    const c = new AbortController();
    const t = setTimeout(() => { fetchTopProductsData(c.signal); }, FETCH_DEBOUNCE_MS);
    return () => { c.abort(); clearTimeout(t); };
  }, [fetchTopProductsData, user]);

  useEffect(() => {
    if (!user) return;
    const c = new AbortController();
    const t = setTimeout(() => { fetchRestockSuggestionsData(c.signal); }, FETCH_DEBOUNCE_MS);
    return () => { c.abort(); clearTimeout(t); };
  }, [fetchRestockSuggestionsData, user]);

  useEffect(() => {
    if (!user) return;
    const c = new AbortController();
    const t = setTimeout(() => { fetchKPIsData(c.signal); }, FETCH_DEBOUNCE_MS);
    return () => { c.abort(); clearTimeout(t); };
  }, [fetchKPIsData, user]);

  useEffect(() => {
    if (!user) return;
    const c = new AbortController();
    const t = setTimeout(() => { fetchInventoryLevels(c.signal); }, FETCH_DEBOUNCE_MS);
    return () => { c.abort(); clearTimeout(t); };
  }, [fetchInventoryLevels, user]);

  useEffect(() => {
    if (!user) return;
    const c = new AbortController();
    const t = setTimeout(() => { fetchCategoryDistribution(c.signal); }, FETCH_DEBOUNCE_MS);
    return () => { c.abort(); clearTimeout(t); };
  }, [fetchCategoryDistribution, user]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadDeliveryChunk({ cursor: 0, mode: 'replace', signal: controller.signal });
    }, FETCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [loadDeliveryChunk, user]);

  useEffect(() => {
    if (!user || branchId || !isOwner) return;
    const c = new AbortController();
    const t = setTimeout(() => { fetchBranchPerformance(c.signal); }, FETCH_DEBOUNCE_MS);
    return () => { c.abort(); clearTimeout(t); };
  }, [branchId, fetchBranchPerformance, isOwner, user]);

  useEffect(() => {
    const c = new AbortController();
    loadBranches(c.signal);
    return () => c.abort();
  }, [loadBranches]);

  /* --------- Helpers ---------- */
  const formatByInterval = (d, intervalType = 'monthly') => {
    if (intervalType === 'daily') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (intervalType === 'weekly') {
      const day = new Date(d);
      const dow = day.getDay();
      const offset = (dow === 0 ? -6 : 1 - dow);
      day.setDate(day.getDate() + offset);
      return day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short' });
  };

  const formatPeriod = (raw) => {
    if (raw == null) return '';
    let p = raw;
    if (p instanceof Date) {
      if (isNaN(p)) return '';
      return formatByInterval(p, salesInterval);
    }
    p = String(p);
    const isoMatch = p.match(/^(\d{4}-\d{2}-\d{2})(T.*)?$/);
    if (isoMatch) {
      const d = dayjs(isoMatch[1], 'YYYY-MM-DD');
      if (d.isValid()) return formatByInterval(d.toDate(), salesInterval);
    }
    const ymMatch = p.match(/^(\d{4})-(\d{2})$/);
    if (ymMatch) {
      const d = dayjs(`${ymMatch[1]}-${ymMatch[2]}-01`, 'YYYY-MM-DD');
      if (d.isValid()) return d.format('MMM');
    }
    return p;
  };

  const compareValues = (current, previous) => {
    if (previous === 0 && current !== 0) return (<span className='flex items-center text-green-500 italic'><FaLongArrowAltUp />  {Number(current.toFixed(2)).toLocaleString()}% Increase!</span>);
    if (previous !== 0 && current === 0) return (<span className='flex items-center text-red-500 italic'><FaLongArrowAltDown />  {Number(previous.toFixed(2)).toLocaleString()}% Decrease!</span>);
    if (previous === current) return "No change";
    const percentageChange = ((current - previous) / (previous || 1)) * 100;
    if (percentageChange > 0) return (<span className='flex items-center text-green-500 italic'><FaLongArrowAltUp />  {Number(percentageChange.toFixed(2)).toLocaleString()}% Increase!</span>);
    if (percentageChange < 0) return (<span className='flex items-center text-red-500 italic'><FaLongArrowAltDown />  {Number(percentageChange.toFixed(2)).toLocaleString()}% Decrease!</span>);
    return "No change";
  };

  /* ---------- UI ---------- */
  return (
    <div className="flex flex-col gap-4 sm:gap-5 flex-1 min-h-0">

      <ExportReportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        availableCharts={useMemo(() => {
          const charts = [{ id: 'kpi-summary', label: 'KPI Summary', ref: kpiRef }];
          if (currentCharts === 'sale') {
            charts.push({ id: 'sales-performance', label: 'Sales Performance & Forecast', ref: salesChartRef });
            charts.push({ id: 'top-products', label: 'Top Products', ref: topProductsRef });
          }
          if (currentCharts === 'delivery') {
            charts.push({ id: 'delivery', label: 'Delivery Analytics', ref: deliveryChartRef });
          }
          if (currentCharts === 'branch' && !branchId && isOwner) {
            charts.push({ id: 'branch-performance', label: 'Branch Performance', ref: branchPerformanceRef });
            charts.push({ id: 'revenue-distribution', label: 'Revenue Distribution', ref: revenueDistributionRef });
            charts.push({ id: 'branch-timeline', label: 'Branch Timeline', ref: branchTimelineRef });
          }
          return charts;
        }, [currentCharts, branchId, isOwner])}
      />

      {/* Outside: View Branch Analytics stays here */}
      <div className="w-full flex justify-end px-3 sm:px-5">
        {!branchId && (
          <NavLink
            to="/branches"
            className="px-3 lg:px-4 py-1 lg:py-2 text-sm lg:text-base border-2 bg-white font-medium rounded-md text-green-800 border-gray-200 hover:bg-green-100 transition"
          >
            View Branch Analytics
          </NavLink>
        )}
      </div>

      {/* Sticky tabs + filters (Export on the right) */}
      <div className="sticky top-0 z-30 bg-white/95 supports-[backdrop-filter]:bg-white/60 backdrop-blur border-b py-3 px-3 sm:px-5 rounded-md">

        {/* Row 1: Tabs + Export */}
{/* Row 1: Tabs + Export */}
<div className="flex items-center gap-3 -mx-2 px-2 overflow-x-auto hide-scrollbar">
  {(branchId || (!branchId && isOwner)) && (
    <div className="flex w-full sm:w-auto sm:min-w-max border-2 rounded-full bg-gray-50 shadow-sm overflow-hidden transition-all duration-200">
      {!branchId && isOwner && (
        <button
          className={`inline-flex items-center justify-center gap-2 py-2 px-5 sm:px-7 font-semibold text-sm flex-1 sm:flex-initial ${currentCharts === "branch" ? "bg-green-800 text-white scale-105 shadow-md" : "text-green-800 hover:bg-green-100 "}`}
          aria-selected={currentCharts === "branch"}
          onClick={() => { setCurrentCharts("branch"); setProductIdFilter(''); }}
        >
          <HiOutlineBuildingOffice2 />
          Branch
        </button>
      )}
      <button
        className={`inline-flex items-center justify-center gap-2 py-2 px-5 sm:px-7 font-semibold text-sm flex-1 sm:flex-initial ${currentCharts === "sale" ? "bg-green-800 text-white scale-105 shadow-md" : "text-green-800 hover:bg-green-100 "}`}
        aria-selected={currentCharts === "sale"}
        onClick={() => setCurrentCharts("sale")}
      >
        <FaRegMoneyBillAlt />
        Sales
      </button>
      {branchId && (
        <button
          className={`inline-flex items-center justify-center gap-2 py-2 px-5 sm:px-7 font-semibold text-sm flex-1 sm:flex-initial ${currentCharts === "delivery" ? "bg-green-800 text-white scale-105 shadow-md" : "text-green-800 hover:bg-green-100 "}`}
          aria-selected={currentCharts === "delivery"}
          onClick={() => setCurrentCharts("delivery")}
        >
          <TbTruckDelivery />
          Delivery
        </button>
      )}
    </div>
  )}

  {/* Desktop/Tablet Export (right side) */}
  <div className="ml-auto shrink-0 hidden md:block">
    <button
      onClick={() => setShowExportDialog(true)}
      className="inline-flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-all shadow-sm"
    >
      <FaFileExport />
      <span className="text-sm">Export Report</span>
    </button>
  </div>
</div>


        {/* Row 2: Filters — single line on md+, stacked on mobile; Start/End aligned */}
        {/* Row 2: Filters — equal width based on mode */}
        <div className={`mt-5 grid grid-cols-1 gap-4 sm:gap-4 items-start ${rangeMode === 'preset' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {/* Category */}
          <div className="min-w-0">
            <CategorySelect
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              onCategoryNameChange={setCategoryName}
            />
          </div>

          {/* Mode */}
          <div className="min-w-0">
            <DropdownCustom
              label="Mode"
              value={rangeMode}
              onChange={(e) => setRangeMode(e.target.value)}
              options={[
                { value: 'preset', label: 'Preset' },
                { value: 'custom', label: 'Custom' },
              ]}
              variant="floating"
            />
          </div>

          {/* PRESET (takes one column in 3-col grid) */}
          {rangeMode === 'preset' && (
            <div className="min-w-0">
              <DropdownCustom
                label="Preset"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                options={[
                  { value: 'current_day', label: 'Current Day' },
                  { value: 'current_week', label: 'Current Week' },
                  { value: 'current_month', label: 'Current Month' },
                  { value: 'current_year', label: 'Current Year' },
                ]}
                variant="floating"
              />
            </div>
          )}

          {/* CUSTOM (Start and End each take one column in 4-col grid) */}
          {rangeMode === 'custom' && (
            <>
              <div className="min-w-0">
                <DatePickerCustom
                  id="kpi-start"
                  label="Start"
                  variant="floating"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                  placeholder="MM/DD/YYYY"
                />
              </div>
              <div className="min-w-0">
                <DatePickerCustom
                  id="kpi-end"
                  label="End"
                  variant="floating"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                  placeholder="MM/DD/YYYY"
                />
              </div>
            </>
          )}

          <div className="mt-3 md:hidden">
  <button
    onClick={() => setShowExportDialog(true)}
    className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-all shadow-sm"
  >
    <FaFileExport />
    <span className="text-sm">Export Report</span>
  </button>
</div>



        </div>


      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto min-w-0 pt-3 pb-16 px-2 sm:px-0 hide-scrollbar">

        {/* KPI CARDS (responsive, equal height) */}
        <div
          ref={kpiRef}
          className="grid w-full gap-3 sm:gap-4 lg:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 auto-rows-fr relative mb-4 sm:mb-2"
        >
          <KPI
            loading={loadingKPIs}
            icon={FaShoppingCart}
            iconClass="text-green-500"
            accentClass="bg-green-400"
            title="Total Sales"
            value={currencyFormat(kpis.total_sales)}
            sub={compareValues(kpis.total_sales, kpis.prev_total_sales)}
            dateRangeDisplay={dateRangeDisplay}
          />
          <KPI
            loading={loadingKPIs}
            icon={FaPiggyBank}
            iconClass="text-yellow-500"
            accentClass="bg-yellow-400"
            title="Total Investment"
            value={currencyFormat(kpis.total_investment)}
            sub={compareValues(kpis.total_investment, kpis.prev_total_investment)}
            dateRangeDisplay={dateRangeDisplay}
          />
          <KPI
            loading={loadingKPIs}
            icon={FaWallet}
            iconClass="text-blue-500"
            accentClass="bg-blue-400"
            title="Total Profit"
            value={kpis.total_sales > kpis.total_investment ? currencyFormat(kpis.total_profit) : currencyFormat(0)}
            sub={compareValues(kpis.total_profit, kpis.prev_total_profit)}
            dateRangeDisplay={dateRangeDisplay}
          />
          <KPI
            loading={loadingKPIs}
            icon={AiFillProduct}
            iconClass="text-purple-500"
            accentClass="bg-purple-400"
            title="Inventory Items"
            value={Number(kpis.inventory_count).toLocaleString()}
            sub="Total distinct products"
            dateRangeDisplay={dateRangeDisplay}
          />
        </div>

        {/* CHARTS */}
        <div className="grid grid-cols-12 gap-2 sm:gap-3 flex-1 min-h-0 min-w-0">
          {currentCharts === "sale" && (
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
              salesChartRef={salesChartRef}
              topProductsRef={topProductsRef}
              restockSuggestions={restockSuggestions}
              loadingRestockSuggestions={loadingRestockSuggestions}
            />
          )}

          {currentCharts === "delivery" && (
            <Delivery
              Card={Card}
              deliveryData={deliveryData}
              deliveryInterval={deliveryInterval}
              setDeliveryInterval={setDeliveryInterval}
              deliveryStatus={deliveryStatus}
              setDeliveryStatus={setDeliveryStatus}
              loadingDelivery={loadingDelivery}
              deliveryChartRef={deliveryChartRef}
              onLoadOlder={handleLoadOlder}
              onResetRange={handleResetDeliveryRange}
              canLoadOlder={canLoadOlder}
              hasExtendedRange={hasExtendedDeliveryRange}
              rangeLabel={deliveryRangeLabel}
              windowLabel={deliveryWindowLabel}
            />
          )}

          {currentCharts === "branch" && !branchId && isOwner && (
            <>
              <BranchPerformance
                Card={Card}
                branchTotals={branchTotals}
                loading={loadingBranchPerformance}
                error={branchError}
                branchPerformanceRef={branchPerformanceRef}
                revenueDistributionRef={revenueDistributionRef}
              />
              <div className="col-span-12 mt-5 min-h-[420px] mb-8">
                <BranchTimeline
                  Card={Card}
                  categoryFilter={categoryFilter}
                  allBranches={allBranches}
                  branchTimelineRef={branchTimelineRef}
                />
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
