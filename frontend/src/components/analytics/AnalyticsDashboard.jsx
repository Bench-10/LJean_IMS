import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  Suspense,
  lazy,
  useTransition
} from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);

import api, { analyticsApi } from '../../utils/api.js';
import { currencyFormat } from '../../utils/formatCurrency.js';
import { NavLink } from "react-router-dom";

const TopProducts = lazy(() => import('./charts/TopProducts.jsx'));
const Delivery = lazy(() => import('./charts/Delivery.jsx'));
const BranchPerformance = lazy(() => import('./charts/BranchPerformance.jsx'));
const BranchTimeline = lazy(() => import('./charts/BranchTimeline.jsx'));
import ExportReportDialog from '../dialogs/ExportReportDialog.jsx';

import { TbTruckDelivery } from "react-icons/tb";
import { FaRegMoneyBillAlt, FaLongArrowAltUp, FaLongArrowAltDown, FaShoppingCart, FaPiggyBank, FaWallet, FaFileExport } from "react-icons/fa";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import { AiFillProduct } from "react-icons/ai";

import { useAuth } from '../../authentication/Authentication.jsx';
import ChartLoading from '../common/ChartLoading.jsx';
import ChartNoData from '../common/ChartNoData.jsx';
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

const PERFORMANCE_CONFIG = {
  cacheTTL: 1000 * 60 * 5,
  cacheStaleThreshold: 1000 * 60 * 2,
  enableBackgroundRefresh: true,
  backgroundRefreshInterval: 1000 * 60 * 3,
  enableBatchRequests: true,
  virtualizationThreshold: 1000,
  salesSamplingLimit: 600,
  timelineSamplingLimit: 700,
  progressiveEnhanceDelay: 180,
  enableCompression: true,
  compressionThreshold: 250,
  virtualizationStrategy: 'sample',
  debugMode: false
};

const CACHE_TTL_MS = PERFORMANCE_CONFIG.cacheTTL;

const PRESET_LABELS = {
  current_day: 'Current Day',
  current_week: 'Current Week',
  current_month: 'Current Month',
  current_year: 'Current Year'
};

const capitalizeLabel = (value) => {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const analyticsCaches = {
  branches: new Map(),
  salesPerformance: new Map(),
  topProducts: new Map(),
  restockTrends: new Map(),
  restockSuggestions: new Map(),
  inventoryLevels: new Map(),
  categoryDistribution: new Map(),
  kpis: new Map(),
  delivery: new Map(),
  branchesSummary: new Map()
};

const pendingRequests = new Map();

const buildCacheKey = (name, params) => `${name}::${JSON.stringify(params)}`;

const COMPRESSION_MARKER = '__compressed';

const sampleArray = (input, limit) => {
  if (!Array.isArray(input) || !limit || input.length <= limit) return input;
  const step = Math.ceil(input.length / limit);
  const result = [];
  for (let i = 0; i < input.length; i += step) {
    result.push(input[i]);
  }
  const last = input[input.length - 1];
  if (result[result.length - 1] !== last) {
    result.push(last);
  }
  return result;
};

const compressArray = (input) => {
  if (!Array.isArray(input) || input.length < PERFORMANCE_CONFIG.compressionThreshold) {
    return input;
  }
  const first = input.find((item) => item && typeof item === 'object');
  if (!first) return input;
  const keys = Array.from(new Set(input.flatMap((item) => (item && typeof item === 'object') ? Object.keys(item) : [])));
  if (!keys.length) return input;
  const rows = keys.map((key) => input.map((item) => (item && typeof item === 'object') ? item[key] ?? null : item));
  return {
    [COMPRESSION_MARKER]: true,
    type: 'object-array',
    keys,
    rows,
    length: input.length
  };
};

const decompressArray = (input) => {
  if (!input || input[COMPRESSION_MARKER] !== true || input.type !== 'object-array') {
    return input;
  }
  const { keys, rows, length } = input;
  const result = Array.from({ length }, (_, index) => {
    const record = {};
    keys.forEach((key, keyIndex) => {
      record[key] = rows[keyIndex]?.[index] ?? null;
    });
    return record;
  });
  return result;
};

const maybeCompress = (value) => {
  if (!PERFORMANCE_CONFIG.enableCompression) return value;
  if (Array.isArray(value)) return compressArray(value);
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      next[key] = maybeCompress(val);
    });
    return next;
  }
  return value;
};

const maybeDecompress = (value) => {
  if (!PERFORMANCE_CONFIG.enableCompression) return value;
  if (Array.isArray(value)) return value.map((item) => maybeDecompress(item));
  if (value && value[COMPRESSION_MARKER]) {
    return maybeDecompress(decompressArray(value));
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      next[key] = maybeDecompress(val);
    });
    return next;
  }
  return value;
};

const getCacheEntry = (name, params) => {
  const cache = analyticsCaches[name];
  if (!cache) return null;
  const key = JSON.stringify(params);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
};

const getCachedValue = (name, params) => getCacheEntry(name, params)?.value ?? null;

const setCachedValue = (name, params, value) => {
  const cache = analyticsCaches[name];
  if (!cache) return;
  const key = JSON.stringify(params);
  cache.set(key, { value, timestamp: Date.now() });
};

const shouldRefreshEntry = (entry) => {
  if (!entry) return false;
  if (!PERFORMANCE_CONFIG.enableBackgroundRefresh) return false;
  return Date.now() - entry.timestamp > PERFORMANCE_CONFIG.cacheStaleThreshold;
};

const fetchAndCache = async (name, params, fetcher, { forceRefresh = false, background = false } = {}) => {
  const existingEntry = forceRefresh ? null : getCacheEntry(name, params);
  if (existingEntry && !forceRefresh) {
    if (!background && shouldRefreshEntry(existingEntry)) {
      setTimeout(() => {
        fetchAndCache(name, params, fetcher, { forceRefresh: true, background: true }).catch((err) => {
          if (PERFORMANCE_CONFIG.debugMode) {
            console.debug(`[AnalyticsDashboard] Background refresh failed for ${name}`, err);
          }
        });
      }, 0);
    }
    return existingEntry.value;
  }

  const cacheKey = buildCacheKey(name, params);
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const promise = (async () => {
    const result = await fetcher();
    setCachedValue(name, params, result);
    return result;
  })()
    .catch((error) => {
      if (!background) throw error;
      if (PERFORMANCE_CONFIG.debugMode) {
        console.debug(`[AnalyticsDashboard] Background fetch error for ${name}`, error);
      }
      return existingEntry?.value;
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, promise);
  return promise;
};

const clearAnalyticsCaches = () => {
  Object.values(analyticsCaches).forEach((cache) => cache.clear());
  pendingRequests.clear();
  cachedCategoryList = null;
};

let cachedCategoryList = null;

const getDashboardStorageKey = (branchId) => `analytics-dashboard-state:${branchId ?? 'global'}`;

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
const Card = ({ title, children, className = '', exportRef, bodyClassName = '', exportId, exportSpans = {} }) => {
  const bodyClasses = ['flex-1', 'min-h-0', bodyClassName].filter(Boolean).join(' ');
  const dataAttrs = {};
  if (exportId) {
    dataAttrs['data-export-section'] = exportId;
  }
  if (exportSpans && typeof exportSpans === 'object') {
    Object.entries(exportSpans).forEach(([key, value]) => {
      if (value == null) return;
      const attrKey = `data-export-span-${key}`;
      dataAttrs[attrKey] = String(value);
    });
  }
  return (
    <div ref={exportRef} {...dataAttrs} className={`flex flex-col border border-gray-200 rounded-md bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="text-[11px] tracking-wide font-semibold text-gray-500 uppercase mb-2">{title}</h2>}
      <div className={bodyClasses}>{children}</div>
    </div>
  );
};

/* ---------- Category select that also exposes the chosen name ---------- */
const CategorySelect = ({ categoryFilter, setCategoryFilter, onCategoryNameChange }) => {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (cachedCategoryList) {
      setList(cachedCategoryList);
      return;
    }
    const controller = new AbortController();
    async function load() {
      try {
        const res = await api.get(`/api/categories`, { signal: controller.signal });
        const data = Array.isArray(res.data) ? res.data : [];
        cachedCategoryList = data;
        setList(data);
      } catch (e) {
        if (e?.code !== 'ERR_CANCELED') console.error(e);
      }
    }
    load();
    return () => controller.abort();
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
    <div className="h-full bg-white rounded-md shadow-sm border border-gray-200 p-4 sm:p-5 relative overflow-hidden" data-kpi-card>
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

          <p className="text-[clamp(18px,5vw,26px)] font-bold leading-tight break-words">
            {value}
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-1 break-words">
            {sub}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({ branchId, canSelectBranch = false }) {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [optimizationsEnabled, setOptimizationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem('analytics:optimizations');
    if (!raw) return true;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'boolean' ? parsed : true;
    } catch (err) {
      return true;
    }
  });

  const storageKey = useMemo(() => getDashboardStorageKey(branchId), [branchId]);
  const persistedState = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Failed to read analytics preferences:', error);
      return null;
    }
  }, [storageKey]);

  const isOwner = useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.role) ? user.role : user?.role ? [user.role] : [];
    return roles.some(role => role.toLowerCase() === 'owner');
  }, [user]);

  // Refs (export)
  const analyticsExportRef = useRef(null);
  const salesChartRef = useRef(null);
  const topProductsRef = useRef(null);
  const deliveryChartRef = useRef(null);
  const branchPerformanceRef = useRef(null);
  const revenueDistributionRef = useRef(null);
  const branchTimelineRef = useRef(null);
  const kpiRef = useRef(null);
  const deliveryRequestIdRef = useRef(0);
  const skipPersistRef = useRef(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const [salesPerformance, setSalesPerformance] = useState({ history: [], forecast: [], series: [] });
  const [restockTrends, setRestockTrends] = useState([]);
  const [inventoryLevels, setInventoryLevels] = useState([]);
  const [categoryDist, setCategoryDist] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [restockSuggestions, setRestockSuggestions] = useState([]);
  const [loadingRestockSuggestions, setLoadingRestockSuggestions] = useState(false);

  const [loadingSalesPerformance, setLoadingSalesPerformance] = useState(false);
  const [loadingTopProducts, setLoadingTopProducts] = useState(false);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [loadingKPIs, setLoadingKPIs] = useState(false);

  const [salesInterval, setSalesInterval] = useState(persistedState?.salesInterval ?? 'monthly');
  const [restockInterval, setRestockInterval] = useState(persistedState?.restockInterval ?? 'monthly');

  const [deliveryInterval, setDeliveryInterval] = useState(persistedState?.deliveryInterval ?? 'monthly');
  const [deliveryStatus, setDeliveryStatus] = useState(persistedState?.deliveryStatus ?? 'delivered');

  const todayISO = dayjs().format('YYYY-MM-DD');
  const monthStartISO = dayjs().startOf('month').format('YYYY-MM-DD');

  const [rangeMode, setRangeMode] = useState(persistedState?.rangeMode ?? 'preset');
  const [preset, setPreset] = useState(persistedState?.preset ?? 'current_month');
  const [startDate, setStartDate] = useState(persistedState?.startDate ?? monthStartISO);
  const [endDate, setEndDate] = useState(persistedState?.endDate ?? todayISO);
  const [categoryFilter, setCategoryFilter] = useState(persistedState?.categoryFilter ?? '');
  const [productIdFilter, setProductIdFilter] = useState(persistedState?.productIdFilter ?? '');
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
    if (persistedState?.currentCharts) return persistedState.currentCharts;
    if (user && !branchId && user.role && user.role.some(role => role.toLowerCase() === 'owner')) {
      return 'branch';
    }
    return 'sale';
  });

  useEffect(() => {
    skipPersistRef.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!persistedState) {
        setRangeMode('preset');
        setPreset('current_month');
        setStartDate(monthStartISO);
        setEndDate(todayISO);
        setCategoryFilter('');
        setProductIdFilter('');
        setSalesInterval('monthly');
        setRestockInterval('monthly');
        setDeliveryInterval('monthly');
        setDeliveryStatus('delivered');
        if (user && !branchId && user.role && user.role.some(role => role.toLowerCase() === 'owner')) {
          setCurrentCharts('branch');
        } else {
          setCurrentCharts('sale');
        }
        skipPersistRef.current = true;
        return;
      }
      if (persistedState.rangeMode) setRangeMode(persistedState.rangeMode);
      if (persistedState.preset) setPreset(persistedState.preset);
      if (persistedState.startDate) setStartDate(persistedState.startDate);
      if (persistedState.endDate) setEndDate(persistedState.endDate);
      if (Object.prototype.hasOwnProperty.call(persistedState, 'categoryFilter')) setCategoryFilter(persistedState.categoryFilter ?? '');
      if (Object.prototype.hasOwnProperty.call(persistedState, 'productIdFilter')) setProductIdFilter(persistedState.productIdFilter ?? '');
      if (persistedState.salesInterval) setSalesInterval(persistedState.salesInterval);
      if (persistedState.restockInterval) setRestockInterval(persistedState.restockInterval);
      if (persistedState.deliveryInterval) setDeliveryInterval(persistedState.deliveryInterval);
      if (persistedState.deliveryStatus) setDeliveryStatus(persistedState.deliveryStatus);
      if (persistedState.currentCharts) setCurrentCharts(persistedState.currentCharts);
      skipPersistRef.current = true;
    } catch (error) {
      console.error('Failed to hydrate analytics preferences:', error);
    }
  }, [branchId, monthStartISO, persistedState, storageKey, todayISO, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const payload = {
      rangeMode,
      preset,
      startDate,
      endDate,
      categoryFilter,
      productIdFilter,
      salesInterval,
      restockInterval,
      deliveryInterval,
      deliveryStatus,
      currentCharts
    };
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist analytics preferences:', error);
    }
  }, [categoryFilter, currentCharts, deliveryInterval, deliveryStatus, endDate, preset, rangeMode, restockInterval, salesInterval, startDate, storageKey, productIdFilter]);

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

  const branchLabelForExport = useMemo(() => {
    if (!branchId) return 'All Branches';
    const idAsString = String(branchId);
    const match = allBranches.find((branch) => {
      if (!branch) return false;
      const candidates = [branch.branch_id, branch.id, branch.branchId, branch.branchID]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));
      return candidates.includes(idAsString);
    });
    if (match) {
      return match.branch_name || match.name || match.label || match.title || `Branch #${branchId}`;
    }
    if (user) {
      const possibleUserIds = [user.branch_id, user.branchId, user.branchID].filter((value) => value !== undefined && value !== null);
      if (possibleUserIds.map((value) => String(value)).includes(idAsString) && user.branch_name) {
        return user.branch_name;
      }
    }
    return `Branch #${branchId}`;
  }, [branchId, allBranches, user]);

  const selectedProductNameForExport = useMemo(() => {
    if (!productIdFilter) return null;
    const numericId = Number(productIdFilter);
    const match = topProducts.find((product) => {
      if (!product) return false;
      const candidates = [product.product_id, product.id, product.productId]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => Number(value));
      return candidates.includes(numericId);
    });
    return match?.product_name || null;
  }, [productIdFilter, topProducts]);

  const dateRangeLabelForExport = useMemo(() => {
    if (rangeMode === 'preset') {
      return dateRangeDisplay || PRESET_LABELS[preset] || 'Preset Range';
    }
    const startLabel = startDate && dayjs(startDate).isValid() ? dayjs(startDate).format('MMM DD, YYYY') : startDate || '—';
    const endLabel = endDate && dayjs(endDate).isValid() ? dayjs(endDate).format('MMM DD, YYYY') : endDate || '—';
    return `${startLabel} - ${endLabel}`;
  }, [rangeMode, dateRangeDisplay, startDate, endDate, preset]);

  const currentViewLabel = useMemo(() => {
    if (currentCharts === 'branch') return 'Branch Performance';
    if (currentCharts === 'delivery') return 'Delivery Analytics';
    return 'Sales & Forecast';
  }, [currentCharts]);

  const exportFilters = useMemo(() => {
    const filters = [
      { label: 'Branch', value: branchLabelForExport },
      { label: 'Category', value: categoryName },
      { label: 'Date Range', value: dateRangeLabelForExport },
      { label: 'View', value: currentViewLabel },
      { label: 'Sales Interval', value: capitalizeLabel(salesInterval) },
      { label: 'Restock Interval', value: capitalizeLabel(restockInterval) },
      { label: 'Delivery Interval', value: capitalizeLabel(deliveryInterval) }
    ];

    if (deliveryStatus) {
      filters.push({ label: 'Delivery Status', value: capitalizeLabel(deliveryStatus) });
    }

    if (productIdFilter) {
      const labelValue = selectedProductNameForExport
        ? `${selectedProductNameForExport} (#${productIdFilter})`
        : `Product ID ${productIdFilter}`;
      filters.push({ label: 'Product Filter', value: labelValue });
    }

    return filters;
  }, [branchLabelForExport, categoryName, currentViewLabel, dateRangeLabelForExport, deliveryInterval, deliveryStatus, productIdFilter, restockInterval, salesInterval, selectedProductNameForExport]);

  const exportKpiSummary = useMemo(() => {
    const toNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const entries = [
      {
        key: 'total_sales',
        label: 'Total Sales',
        value: toNumber(kpis.total_sales),
        previous: toNumber(kpis.prev_total_sales),
        format: 'currency'
      },
      {
        key: 'total_investment',
        label: 'Total Investment',
        value: toNumber(kpis.total_investment),
        previous: toNumber(kpis.prev_total_investment),
        format: 'currency'
      },
      {
        key: 'total_profit',
        label: 'Total Profit',
        value: toNumber(kpis.total_profit),
        previous: toNumber(kpis.prev_total_profit),
        format: 'currency'
      },
      {
        key: 'inventory_count',
        label: 'Inventory Items',
        value: toNumber(kpis.inventory_count),
        previous: null,
        format: 'number'
      }
    ];

    return entries.filter((entry) => Number.isFinite(entry.value));
  }, [kpis]);

  const exportMeta = useMemo(() => {
    const generatedAt = new Date().toISOString();
    const subtitle = currentCharts === 'branch'
      ? 'Branch Performance Overview'
      : currentCharts === 'delivery'
        ? 'Delivery Performance Overview'
        : 'Sales & Forecast Overview';

    return {
      title: 'Analytics Intelligence Report',
      subtitle,
      branchName: branchLabelForExport,
      categoryName,
      dateRange: dateRangeLabelForExport,
      generatedAt,
      filters: exportFilters,
      kpis: exportKpiSummary,
      intervals: {
        sales: salesInterval,
        restock: restockInterval,
        delivery: deliveryInterval
      },
      deliveryStatus,
      currentView: currentViewLabel,
      productFilter: productIdFilter ? {
        id: productIdFilter,
        name: selectedProductNameForExport || null
      } : null
    };
  }, [branchLabelForExport, categoryName, currentCharts, dateRangeLabelForExport, deliveryInterval, deliveryStatus, exportFilters, exportKpiSummary, currentViewLabel, productIdFilter, restockInterval, salesInterval, selectedProductNameForExport]);

  const exportableCharts = useMemo(() => {
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
  }, [branchId, currentCharts, isOwner]);

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
    const cacheParams = { scope: 'all' };
    const cached = getCachedValue('branches', cacheParams);
    if (cached) {
      setAllBranches(maybeDecompress(cached));
      return;
    }
    try {
      const data = await fetchAndCache('branches', cacheParams, async () => {
        const res = await analyticsApi.get(`/api/analytics/branches`, { signal });
        const payload = Array.isArray(res.data) ? res.data : [];
        return maybeCompress(payload);
      });
      setAllBranches(maybeDecompress(data));
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
    setRestockSuggestions([]);
    setLoadingRestockSuggestions(false);
    clearAnalyticsCaches();
  }, []);

  useEffect(() => {
    if (user) return;
    resetAnalyticsState();
  }, [resetAnalyticsState, user]);

  const fetchSalesPerformance = useCallback(async (signal, { silent = false } = {}) => {
    if (!user) return;
    const params = { interval: salesInterval };
    if (branchId) params.branch_id = branchId;
    if (categoryFilter) params.category_id = categoryFilter;
    if (productIdFilter) params.product_id = productIdFilter;
    const cacheParams = {
      branch: branchId ?? 'all',
      category: categoryFilter || 'all',
      product: productIdFilter || 'all',
      interval: salesInterval
    };
    const cached = getCachedValue('salesPerformance', cacheParams);
    if (cached) {
      setSalesPerformance(maybeDecompress(cached));
      if (silent) {
        // Background refresh to update cache and state silently
        fetchAndCache('salesPerformance', cacheParams, async () => {
          const response = await analyticsApi.get(`/api/analytics/sales-performance`, { params, signal });
          const payload = Array.isArray(response.data)
            ? { history: response.data, forecast: [], series: response.data }
            : {
                history: response.data?.history ?? [],
                forecast: response.data?.forecast ?? [],
                series: response.data?.series ?? response.data?.history ?? []
              };
          if (optimizationsEnabled && PERFORMANCE_CONFIG.salesSamplingLimit) {
            const sampledHistory = sampleArray(payload.history, PERFORMANCE_CONFIG.salesSamplingLimit);
            const sampledSeries = sampleArray(payload.series, PERFORMANCE_CONFIG.salesSamplingLimit);
            return maybeCompress({ ...payload, history: sampledHistory, series: sampledSeries });
          }
          return maybeCompress(payload);
        }, { forceRefresh: true, background: true })
          .then((normalized) => {
            if (normalized) setSalesPerformance(maybeDecompress(normalized));
          })
          .catch(() => {});
      } else {
        setLoadingSalesPerformance(false);
      }
      if (!silent) return;
    }
    if (!silent) setLoadingSalesPerformance(true);
    try {
      const normalized = await fetchAndCache('salesPerformance', cacheParams, async () => {
        const response = await analyticsApi.get(`/api/analytics/sales-performance`, { params, signal });
        const payload = Array.isArray(response.data)
          ? { history: response.data, forecast: [], series: response.data }
          : {
              history: response.data?.history ?? [],
              forecast: response.data?.forecast ?? [],
              series: response.data?.series ?? response.data?.history ?? []
            };
        if (optimizationsEnabled && PERFORMANCE_CONFIG.salesSamplingLimit) {
          const sampledHistory = sampleArray(payload.history, PERFORMANCE_CONFIG.salesSamplingLimit);
          const sampledSeries = sampleArray(payload.series, PERFORMANCE_CONFIG.salesSamplingLimit);
          return maybeCompress({
            ...payload,
            history: sampledHistory,
            series: sampledSeries
          });
        }
        return maybeCompress(payload);
      }, silent ? { forceRefresh: true, background: true } : undefined);
      setSalesPerformance(maybeDecompress(normalized));
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Sales performance fetch error', e);
    } finally {
      if (!silent) setLoadingSalesPerformance(false);
    }
  }, [branchId, categoryFilter, productIdFilter, salesInterval, user, optimizationsEnabled]);

  const fetchTopProductsData = useCallback(async (signal, { silent = false } = {}) => {
    if (!user) return;

    const paramsTop = {
      branch_id: branchId || undefined,
      category_id: categoryFilter || undefined,
      start_date: resolvedRange.start_date,
      end_date: resolvedRange.end_date,
      limit: optimizationsEnabled ? 40 : 50,
      interval: 'monthly',
      include_forecast: false
    };

    const paramsRestock = { interval: restockInterval };
    if (branchId) paramsRestock.branch_id = branchId;

    const topKey = {
      branch: branchId ?? 'all',
      category: categoryFilter || 'all',
      start: resolvedRange.start_date,
      end: resolvedRange.end_date,
      limit: paramsTop.limit,
      interval: paramsTop.interval
    };
    const restockKey = {
      branch: branchId ?? 'all',
      interval: restockInterval
    };

    const cachedTop = getCachedValue('topProducts', topKey);
    const cachedRestock = getCachedValue('restockTrends', restockKey);

    if (cachedTop) setTopProducts(maybeDecompress(cachedTop));
    if (cachedRestock) setRestockTrends(maybeDecompress(cachedRestock));

    const tasks = [];

    if (!cachedTop || silent) {
      tasks.push(
        fetchAndCache('topProducts', topKey, async () => {
          const response = await analyticsApi.get(`/api/analytics/top-products`, { params: paramsTop, signal });
          const data = Array.isArray(response.data) ? response.data : [];
          const payload = optimizationsEnabled && PERFORMANCE_CONFIG.virtualizationThreshold
            ? sampleArray(data, PERFORMANCE_CONFIG.virtualizationThreshold)
            : data;
          return maybeCompress(payload);
        }, silent ? { forceRefresh: true, background: true } : undefined)
          .then((data) => setTopProducts(maybeDecompress(data)))
          .catch((err) => {
            if (err?.code === 'ERR_CANCELED') return;
            console.error('Top products fetch error', err);
            setTopProducts([]);
          })
      );
    }

    if (!cachedRestock || silent) {
      tasks.push(
        fetchAndCache('restockTrends', restockKey, async () => {
          const response = await analyticsApi.get(`/api/analytics/restock-trends`, { params: paramsRestock, signal });
          const data = Array.isArray(response.data) ? response.data : [];
          const payload = optimizationsEnabled ? sampleArray(data, 200) : data;
          return maybeCompress(payload);
        }, silent ? { forceRefresh: true, background: true } : undefined)
          .then((data) => setRestockTrends(maybeDecompress(data)))
          .catch((err) => {
            if (err?.code === 'ERR_CANCELED') return;
            console.error('Restock trends fetch error', err);
            setRestockTrends([]);
          })
      );
    }

    if (tasks.length === 0) {
      if (!silent) setLoadingTopProducts(false);
      return;
    }

    if (!silent) setLoadingTopProducts(true);
    try {
      await Promise.all(tasks);
    } finally {
      if (!silent) setLoadingTopProducts(false);
    }
  }, [branchId, categoryFilter, resolvedRange, restockInterval, user, optimizationsEnabled]);

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

    const cacheParams = {
      branch: branchId ?? 'all',
      category: categoryFilter || 'all',
      start: resolvedRange.start_date,
      end: resolvedRange.end_date,
      interval: salesInterval,
      includeForecast: true
    };

    const cached = getCachedValue('restockSuggestions', cacheParams);
    if (cached) {
      setRestockSuggestions(maybeDecompress(cached));
      setLoadingRestockSuggestions(false);
      return;
    }

    setLoadingRestockSuggestions(true);
    try {
      const data = await fetchAndCache('restockSuggestions', cacheParams, async () => {
        const response = await analyticsApi.get(`/api/analytics/top-products`, { params, signal });
        const payload = Array.isArray(response.data) ? response.data : [];
        return maybeCompress(payload);
      });
      setRestockSuggestions(maybeDecompress(data));
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Restock suggestions fetch error', e);
      setRestockSuggestions([]);
    } finally {
      setLoadingRestockSuggestions(false);
    }
  }, [branchId, categoryFilter, resolvedRange, salesInterval, user]);

  const fetchInventoryLevels = useCallback(async (signal, { silent = false } = {}) => {
    if (!user) return;
    const params = {};
    if (branchId) params.branch_id = branchId;
    const cacheParams = {
      branch: branchId ?? 'all'
    };
    const cached = getCachedValue('inventoryLevels', cacheParams);
    if (cached) {
      setInventoryLevels(maybeDecompress(cached));
      if (silent) {
        fetchAndCache('inventoryLevels', cacheParams, async () => {
          const response = await analyticsApi.get(`/api/analytics/inventory-levels`, { params, signal });
          const payload = Array.isArray(response.data) ? response.data : [];
          return maybeCompress(payload);
        }, { forceRefresh: true, background: true })
          .then((data) => {
            if (data) setInventoryLevels(maybeDecompress(data));
          })
          .catch(() => {});
      }
      if (!silent) return;
    }
    try {
      const data = await fetchAndCache('inventoryLevels', cacheParams, async () => {
        const response = await analyticsApi.get(`/api/analytics/inventory-levels`, { params, signal });
        const payload = Array.isArray(response.data) ? response.data : [];
        return maybeCompress(payload);
      }, silent ? { forceRefresh: true, background: true } : undefined);
      setInventoryLevels(maybeDecompress(data));
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Inventory levels fetch error', e);
    }
  }, [branchId, user]);

  const fetchCategoryDistribution = useCallback(async (signal, { silent = false } = {}) => {
    if (!user) return;
    const params = branchId ? { branch_id: branchId } : {};
    const cacheParams = {
      branch: branchId ?? 'all'
    };
    const cached = getCachedValue('categoryDistribution', cacheParams);
    if (cached) {
      setCategoryDist(maybeDecompress(cached));
      if (silent) {
        fetchAndCache('categoryDistribution', cacheParams, async () => {
          const response = await analyticsApi.get(`/api/analytics/category-distribution`, { params, signal });
          const payload = Array.isArray(response.data) ? response.data : [];
          return maybeCompress(payload);
        }, { forceRefresh: true, background: true })
          .then((data) => { if (data) setCategoryDist(maybeDecompress(data)); })
          .catch(() => {});
      }
      if (!silent) return;
    }
    try {
      const data = await fetchAndCache('categoryDistribution', cacheParams, async () => {
        const response = await analyticsApi.get(`/api/analytics/category-distribution`, { params, signal });
        const payload = Array.isArray(response.data) ? response.data : [];
        return maybeCompress(payload);
      }, silent ? { forceRefresh: true, background: true } : undefined);
      setCategoryDist(maybeDecompress(data));
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Category distribution fetch error', e);
    }
  }, [branchId, user]);

  const fetchKPIsData = useCallback(async (signal, { silent = false } = {}) => {
    if (!user) return;
    console.log('[AnalyticsDashboard] fetchKPIsData called with silent:', silent);
    const params = {
      start_date: resolvedRange.start_date,
      end_date: resolvedRange.end_date,
      preset: resolvedRange.presetKey
    };
    if (branchId) params.branch_id = branchId;
    if (categoryFilter) params.category_id = categoryFilter;
    if (productIdFilter) params.product_id = productIdFilter;

    const cacheParams = {
      branch: branchId ?? 'all',
      category: categoryFilter || 'all',
      product: productIdFilter || 'all',
      start: resolvedRange.start_date,
      end: resolvedRange.end_date,
      preset: resolvedRange.presetKey
    };

    const cached = getCachedValue('kpis', cacheParams);
    if (cached) {
      console.log('[AnalyticsDashboard] Using cached KPI data:', cached);
      setKpis(maybeDecompress(cached));
      if (silent) {
        fetchAndCache('kpis', cacheParams, async () => {
          const response = await analyticsApi.get(`/api/analytics/kpis`, { params, signal });
          const payload = response.data || {
            total_sales: 0,
            total_investment: 0,
            total_profit: 0,
            prev_total_sales: 0,
            prev_total_investment: 0,
            prev_total_profit: 0,
            inventory_count: 0
          };
          console.log('[AnalyticsDashboard] Background refresh fetched new KPI data:', payload);
          return maybeCompress(payload);
        }, { forceRefresh: true, background: true })
          .then((data) => { if (data) setKpis(maybeDecompress(data)); })
          .catch(() => {});
      } else {
        setLoadingKPIs(false);
      }
      if (!silent) return;
    }

    if (!silent) setLoadingKPIs(true);
    try {
      const data = await fetchAndCache('kpis', cacheParams, async () => {
        const response = await analyticsApi.get(`/api/analytics/kpis`, { params, signal });
        const payload = response.data || {
          total_sales: 0,
          total_investment: 0,
          total_profit: 0,
          prev_total_sales: 0,
          prev_total_investment: 0,
          prev_total_profit: 0,
          inventory_count: 0
        };
        console.log('[AnalyticsDashboard] Fetched fresh KPI data:', payload);
        return maybeCompress(payload);
      }, silent ? { forceRefresh: true, background: true } : undefined);
      setKpis(maybeDecompress(data));
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
      if (!silent) setLoadingKPIs(false);
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

  const loadDeliveryChunk = useCallback(async ({ cursor = 0, mode = 'replace', signal, silent = false, forceRefresh = false } = {}) => {
    if (!user) return;
    const range = computeDeliveryRange(cursor);
    if (!range) return;

    // Helper to fetch one status (delivered/undelivered) and return filled series
    const fetchStatus = async (status) => {
      const params = {
        format: deliveryInterval,
        status,
        start_date: range.start_date,
        end_date: range.end_date
      };
      if (branchId) params.branch_id = branchId;

      const cacheParams = {
        branch: branchId ?? 'all',
        interval: deliveryInterval,
        status,
        cursor,
        start: range.start_date,
        end: range.end_date
      };

      if (!forceRefresh) {
        const cached = getCachedValue('delivery', cacheParams);
        if (cached) {
          return maybeDecompress(cached);
        }
      }

      const result = await fetchAndCache(
        'delivery',
        cacheParams,
        async () => {
          const response = await analyticsApi.get(`/api/analytics/delivery`, { params, signal });
          const payload = response.data;
          const rawRows = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];
          const filled = fillDeliverySeries(rawRows, deliveryInterval, range.start_date, range.end_date).map((entry) => ({
            ...entry,
            delivered: status === 'delivered' ? Number(entry.number_of_deliveries ?? entry.delivered ?? 0) : 0,
            undelivered: status === 'undelivered' ? Number(entry.number_of_deliveries ?? entry.undelivered ?? 0) : 0
          }));
          const metaPayload = payload?.meta ?? {};
          return maybeCompress({ data: filled, meta: metaPayload });
        },
        forceRefresh ? { forceRefresh: true } : undefined
      );

      return maybeDecompress(result);
    };

    const requestId = deliveryRequestIdRef.current + 1;
    deliveryRequestIdRef.current = requestId;
    if (!silent) setLoadingDelivery(true);

    try {
      // Fetch both delivered and undelivered in parallel, then merge into grouped series
      const [deliveredRes, undeliveredRes] = await Promise.all([
        fetchStatus('delivered'),
        fetchStatus('undelivered')
      ]);

      const deliveredSeries = deliveredRes?.data ?? [];
      const undeliveredSeries = undeliveredRes?.data ?? [];

      const mergedMap = new Map();
      deliveredSeries.forEach((item) => {
        const key = String(item.date);
        const existing = mergedMap.get(key) || { date: key, delivered: 0, undelivered: 0 };
        existing.delivered = Number(item.delivered ?? item.number_of_deliveries ?? 0) || 0;
        mergedMap.set(key, existing);
      });
      undeliveredSeries.forEach((item) => {
        const key = String(item.date);
        const existing = mergedMap.get(key) || { date: key, delivered: 0, undelivered: 0 };
        existing.undelivered = Number(item.undelivered ?? item.number_of_deliveries ?? 0) || 0;
        mergedMap.set(key, existing);
      });

      const mergedSeries = Array.from(mergedMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => v);

      if (mode === 'prepend') {
        setDeliveryData((prev) => {
          // merge older (mergedSeries) before existing
          const existing = Array.isArray(prev) ? prev : [];
          const map = new Map();
          existing.forEach(it => map.set(String(it.date), { date: String(it.date), delivered: Number(it.delivered)||0, undelivered: Number(it.undelivered)||0 }));
          mergedSeries.forEach(it => {
            const ex = map.get(it.date) || { date: it.date, delivered: 0, undelivered: 0 };
            ex.delivered = (ex.delivered || 0) + (it.delivered || 0);
            ex.undelivered = (ex.undelivered || 0) + (it.undelivered || 0);
            map.set(it.date, ex);
          });
          return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([,v])=>v);
        });
        setDeliveryOldestCursor((prev) => Math.max(prev, cursor));
      } else {
        setDeliveryData(mergedSeries);
        setDeliveryOldestCursor(cursor);
      }

      // prefer delivered meta if available
      setDeliveryMeta(deliveredRes?.meta ?? undeliveredRes?.meta ?? { ...DELIVERY_META_DEFAULT });
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') console.error('Delivery analytics fetch error', e);
      if (mode === 'replace') setDeliveryData([]);
    } finally {
      if (!silent && deliveryRequestIdRef.current === requestId) {
        setLoadingDelivery(false);
      }
    }
  }, [branchId, computeDeliveryRange, deliveryInterval, user]);

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

  // Real-time updates: listen for socket-driven analytics events and refresh silently
  useEffect(() => {
    const onSale = () => {
      const c = new AbortController();
      fetchKPIsData(c.signal, { silent: true });
      fetchSalesPerformance(c.signal, { silent: true });
      fetchCategoryDistribution(c.signal, { silent: true });
      fetchTopProductsData(c.signal, { silent: true });
    };
    const onInventory = () => {
      const c = new AbortController();
      fetchInventoryLevels(c.signal, { silent: true });
      fetchCategoryDistribution(c.signal, { silent: true });
      fetchTopProductsData(c.signal, { silent: true });
      fetchKPIsData(c.signal, { silent: true });
    };
    const onDelivery = (options = {}) => {
      const c = new AbortController();
      loadDeliveryChunk({
        cursor: deliveryOldestCursor || 0,
        mode: 'replace',
        signal: c.signal,
        silent: true,
        forceRefresh: options.forceRefresh === true
      });
    };

    const saleHandler = (e) => {
      const action = e?.detail?.action;
      onSale();
      if (action && (action.includes('delivery') || action === 'delivery_status_change')) {
        onDelivery({ forceRefresh: true });
      }
    };
    const inventoryHandler = () => {
    console.log('[AnalyticsDashboard] Received analytics-inventory-update event, calling fetchKPIsData');
    onInventory();
  };

    window.addEventListener('analytics-sale-update', saleHandler);
    window.addEventListener('analytics-inventory-update', inventoryHandler);

    return () => {
      window.removeEventListener('analytics-sale-update', saleHandler);
      window.removeEventListener('analytics-inventory-update', inventoryHandler);
    };
  }, [deliveryOldestCursor, fetchCategoryDistribution, fetchInventoryLevels, fetchKPIsData, fetchSalesPerformance, fetchTopProductsData, loadDeliveryChunk]);

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
    if (intervalType === 'yearly') return d.toLocaleDateString('en-US', { year: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
      if (d.isValid()) return d.format('MMM YYYY');
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
    <div className="flex flex-col gap-4 sm:gap-2 flex-1 min-h-0">

      <ExportReportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        availableCharts={exportableCharts}
        meta={exportMeta}
        exportContainerRef={analyticsExportRef}
      />

      {/* Sticky header: View Branch Analytics (mobile top) + Tabs + Export */}
      <div className="sticky top-0 z-30 bg-white/95 supports-[backdrop-filter]:bg-white/60 backdrop-blur border-b py-3 px-3 sm:px-5 rounded-md" data-export-exclude>

        {/* Mobile: View Branch Analytics at the very top */}
        {!branchId && (
          <div className="md:hidden mb-3">
            <NavLink
              to="/branches"
              className="w-full inline-flex items-center justify-center px-4 py-2 text-sm border bg-white font-medium rounded-md text-green-800 border-gray-200 hover:bg-green-100 transition"
            >
              View Branch Analytics
            </NavLink>
          </div>
        )}

        {/* Row 1: Tabs + Export (desktop) + View Branch Analytics (desktop, spaced) */}
        <div className="flex items-center gap-3 -mx-2 px-2 overflow-x-auto hide-scrollbar">
          {(branchId || (!branchId && isOwner)) && (
            <div className="flex w-full sm:w-auto sm:min-w-max border-2 rounded-lg bg-gray-50 shadow-sm overflow-hidden transition-all duration-200">
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

          {/* Right controls (desktop): Export + View Branch Analytics with spacing */}
          <div className="ml-auto shrink-0 hidden md:flex items-center">
            {!branchId && (
              <NavLink
                to="/branches"
                className="inline-flex items-center justify-center px-4 py-2 text-sm border bg-white font-medium rounded-md text-green-800 border-gray-200 hover:bg-green-100 transition"
              >
                View Branch Analytics
              </NavLink>
            )}
            
            <button
              onClick={() => setShowExportDialog(true)}
              className="md:ml-4 inline-flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-all shadow-sm"
            >
              <FaFileExport />
              <span className="text-sm">Export Report</span>
            </button>

            
          </div>
        </div>

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

          {/* PRESET */}
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

          {/* CUSTOM */}
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

          {/* Mobile Export button (kept below filters); View Branch Analytics is already on top (mobile) */}
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
      <div
        ref={analyticsExportRef}
        data-analytics-root="true"
        className="flex-1 min-h-0 overflow-y-auto min-w-0 pb-20 px-2 sm:px-0 hide-scrollbar"
      >

        {/* KPI CARDS */}
        <div
          ref={kpiRef}
          data-export-section="kpi-summary"
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
        <div className="grid grid-cols-12 gap-2 sm:gap-3 flex-1 min-h-0 min-w-0" data-export-grid="analytics-charts">
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
              onRetryTopProducts={() => fetchTopProductsData()}
              onRetrySalesPerformance={() => fetchSalesPerformance()}
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
                categoryFilter={categoryFilter}
                startDate={resolvedRange.start_date}
                endDate={resolvedRange.end_date}
                branchPerformanceRef={branchPerformanceRef}
                revenueDistributionRef={revenueDistributionRef}
              />
              <BranchTimeline
                Card={Card}
                categoryFilter={categoryFilter}
                branchTimelineRef={branchTimelineRef}
              />
            </>
          )}
        </div>

      </div>
    </div>
  );
}
