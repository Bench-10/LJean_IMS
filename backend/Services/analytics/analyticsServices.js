import { SQLquery } from '../../db.js';
import { correctDateFormat } from '../Services_Utils/convertRedableDate.js';
import dayjs from 'dayjs';
import { runDemandForecast } from '../forecasting/forecastService.js';

const INTERVAL_UNIT_MAP = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year'
};

const HISTORY_LOOKBACK_CONFIG = {
  daily: { periods: 365, unit: 'day', maxPoints: 450 },
  weekly: { periods: 52, unit: 'week', maxPoints: 160 },
  monthly: { periods: 12, unit: 'month', maxPoints: 72 },
  yearly: { periods: 5, unit: 'year', maxPoints: 15 },
  default: { periods: 12, unit: 'month', maxPoints: 72 }
};

function alignToInterval(date, interval) {
  const base = dayjs(date);
  if (!base.isValid()) {
    return null;
  }
  switch (interval) {
    case 'daily':
      return base.startOf('day');
    case 'weekly': {
      const diff = (base.day() + 6) % 7;
      return base.subtract(diff, 'day').startOf('day');
    }
    case 'monthly':
      return base.startOf('month');
    case 'yearly':
      return base.startOf('year');
    default:
      return base.startOf(INTERVAL_UNIT_MAP[interval] || 'month');
  }
}

function addInterval(date, interval, amount = 1) {
  const unit = INTERVAL_UNIT_MAP[interval] || 'month';
  const base = dayjs(date);
  if (!base.isValid()) {
    return base;
  }
  const next = base.add(amount, unit);
  return alignToInterval(next, interval) || next;
}

function normalizeNumeric(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function resampleTimeSeries(rows, interval, start, end, numericKeys = [], options = {}) {
  const data = Array.isArray(rows) ? rows.slice() : [];
  const numericFields = Array.isArray(numericKeys) ? numericKeys : [];
  const staticFields = options.staticFields || {};
  const normalized = data
    .map((row) => {
      const primary = dayjs(row.period);
      let periodKey;
      if (primary.isValid()) {
        periodKey = primary.format('YYYY-MM-DD');
      } else {
        const fallback = dayjs(String(row.period));
        periodKey = fallback.isValid() ? fallback.format('YYYY-MM-DD') : String(row.period ?? '');
      }
      const result = { ...row, period: periodKey };
      for (const key of numericFields) {
        result[key] = normalizeNumeric(result[key]);
      }
      return result;
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  const startCandidate = start ? dayjs(start) : (normalized[0] ? dayjs(normalized[0].period) : null);
  const endCandidate = end ? dayjs(end) : (normalized.length ? dayjs(normalized[normalized.length - 1].period) : null);

  if (!startCandidate?.isValid() || !endCandidate?.isValid()) {
    return normalized;
  }

  let cursor = alignToInterval(startCandidate, interval);
  let final = alignToInterval(endCandidate, interval);

  if (!cursor || !final) {
    return normalized;
  }

  if (cursor.isAfter(final)) {
    [cursor, final] = [final, cursor];
  }

  const unit = INTERVAL_UNIT_MAP[interval] || 'month';
  const expectedCount = Math.floor(final.diff(cursor, unit, true)) + 1;
  const configLimit = options.maxPoints ?? HISTORY_LOOKBACK_CONFIG[interval]?.maxPoints ?? expectedCount;
  const maxIterations = Math.max(expectedCount, configLimit);

  const lookup = new Map();
  for (const row of normalized) {
    const key = alignToInterval(row.period, interval);
    if (!key) {
      continue;
    }
    lookup.set(key.format('YYYY-MM-DD'), row);
  }

  const filled = [];
  let iterations = 0;
  while ((cursor.isBefore(final) || cursor.isSame(final)) && iterations < maxIterations) {
    const key = cursor.format('YYYY-MM-DD');
    const existing = lookup.get(key);
    const base = existing ? { ...existing } : { period: key, ...staticFields };

    if (!existing) {
      Object.assign(base, staticFields);
    }

    for (const numericKey of numericFields) {
      base[numericKey] = normalizeNumeric(existing ? existing[numericKey] : 0);
    }

    base.period = key;
    filled.push(base);
    cursor = addInterval(cursor, interval, 1);
    iterations += 1;
  }

  return filled;
}

function computeHistoryStart(start, end, interval) {
  if (!end) {
    return start;
  }
  const endDate = dayjs(end);
  if (!endDate.isValid()) {
    return start;
  }
  const config = HISTORY_LOOKBACK_CONFIG[interval] || HISTORY_LOOKBACK_CONFIG.default;
  const offsetPeriods = Math.max((config?.periods || 0) - 1, 0);
  const candidate = alignToInterval(endDate.subtract(offsetPeriods, config.unit), interval) || endDate;
  if (!start) {
    return candidate.format('YYYY-MM-DD');
  }
  const startDate = dayjs(start);
  if (!startDate.isValid() || startDate.isAfter(candidate)) {
    return candidate.format('YYYY-MM-DD');
  }
  return start;
}


const RESTORED_SALES_FILTER = `(s.is_for_delivery = false OR EXISTS (
    SELECT 1 FROM Delivery d 
    WHERE d.sales_information_id = s.sales_information_id 
    AND (COALESCE(d.is_delivered,false) = true OR COALESCE(d.is_pending,false) = true)
  ))`;

const ANALYTICS_CACHE_TTL_MS = 2 * 60 * 1000;
const ANALYTICS_CACHE_MAX_ENTRIES = 128;
const analyticsCache = new Map();

function makeAnalyticsCacheKey(name, payload) {
  return `${name}::${JSON.stringify(payload)}`;
}

function getAnalyticsCache(key) {
  const entry = analyticsCache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.timestamp > ANALYTICS_CACHE_TTL_MS) {
    analyticsCache.delete(key);
    return null;
  }
  return entry.value;
}

function setAnalyticsCache(key, value) {
  if (analyticsCache.size >= ANALYTICS_CACHE_MAX_ENTRIES) {
    const [oldestKey] = analyticsCache.keys();
    analyticsCache.delete(oldestKey);
  }
  analyticsCache.set(key, { value, timestamp: Date.now() });
}

export function invalidateAnalyticsCache(prefix) {
  if (!prefix) {
    analyticsCache.clear();
    return;
  }

  for (const key of Array.from(analyticsCache.keys())) {
    if (key.startsWith(prefix)) {
      analyticsCache.delete(key);
    }
  }
}

function buildSalesFilters({ start, end, branch_id, category_id }) {
  const filters = ['s.date BETWEEN $1 AND $2', RESTORED_SALES_FILTER];
  const params = [start, end];
  let nextIdx = 3;
  if (branch_id) {
    filters.push(`s.branch_id = $${nextIdx++}`);
    params.push(branch_id);
  }
  if (category_id) {
    filters.push(`ip.category_id = $${nextIdx++}`);
    params.push(category_id);
  }
  return { filters, params, nextIdx };
}


function buildDateRange(range){

  if(typeof range !== 'string' || !/^[0-9]+[ymd]$/.test(range)) range = '6m';
  const now = new Date();
  let start;
  const n = parseInt(range, 10);
  if(range.endsWith('y')) start = new Date(now.getFullYear()-n, now.getMonth(), now.getDate());
  else if(range.endsWith('m')) start = new Date(now.getFullYear(), now.getMonth()-n, now.getDate());
  else if(range.endsWith('d')) start = new Date(now.getFullYear(), now.getMonth(), now.getDate()-n);
  else start = new Date(now.getFullYear(), now.getMonth()-6, now.getDate());
  return { start: start.toISOString().slice(0,10), end: now.toISOString().slice(0,10) };
}





export async function fetchInventoryLevels({ branch_id, range }) {
  const { start, end } = buildDateRange(range);
 
  const cacheKey = makeAnalyticsCacheKey('fetchInventoryLevels', { branch_id, range: `${start}_${end}` });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  const branchFilter = branch_id ? 'AND ip.branch_id = $3' : '';
  const params = [start, end];
  if(branch_id) params.push(branch_id);
  const { rows } = await SQLquery(`
    WITH adds AS (
      SELECT a.product_id, a.branch_id, a.date_added::date AS d, SUM(a.quantity_added_display) qty_added
      FROM Add_Stocks a
      WHERE a.date_added BETWEEN $1 AND $2
      GROUP BY 1,2,3
    ), sales AS (
      SELECT si.product_id, s.branch_id, s.date::date AS d, SUM(si.quantity_display) qty_sold
      FROM Sales_Items si
      JOIN Sales_Information s USING(sales_information_id)
      WHERE s.date BETWEEN $1 AND $2
      GROUP BY 1,2,3
    ), calendar AS (
      SELECT generate_series($1::date, $2::date, interval '1 day')::date AS d
    ), products AS (
      SELECT ip.product_id, ip.product_name, ip.branch_id FROM Inventory_Product ip WHERE 1=1 ${branchFilter}
    ), daily AS (
      SELECT c.d, p.product_id, p.product_name, p.branch_id, COALESCE(a.qty_added,0) qty_added, COALESCE(s.qty_sold,0) qty_sold
      FROM calendar c CROSS JOIN products p
      LEFT JOIN adds a ON a.product_id = p.product_id AND a.branch_id = p.branch_id AND a.d = c.d
      LEFT JOIN sales s ON s.product_id = p.product_id AND s.branch_id = p.branch_id AND s.d = c.d
    ), cumulative AS (
      SELECT d, product_id, product_name, branch_id,
        SUM(qty_added - qty_sold) OVER (PARTITION BY product_id, branch_id ORDER BY d ROWS UNBOUNDED PRECEDING) AS stock_level
      FROM daily
    )
    SELECT d as date, product_id, product_name, branch_id, stock_level
    FROM cumulative
    ORDER BY product_id, branch_id, d;`, params);
  setAnalyticsCache(cacheKey, rows);
  return rows;
}





export async function fetchSalesPerformance({ branch_id, category_id, product_id, interval, range, start_date, end_date, use_net_amount }) {
  let start;
  let end;

  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : interval === 'yearly' ? 'year' : 'month';
  const hasCategoryFilter = Boolean(category_id);
  const hasProductFilter = Boolean(product_id);
  const shouldUseSalesItems = hasCategoryFilter || hasProductFilter;
  const useNetAmount = Boolean(use_net_amount) && !shouldUseSalesItems;

  const cacheKey = makeAnalyticsCacheKey('fetchSalesPerformance', {
    branch_id,
    category_id,
    product_id,
    interval,
    start,
    end,
    use_net_amount: useNetAmount
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  let rows;

  if (shouldUseSalesItems) {
    const { filters, params, nextIdx } = buildSalesFilters({ start, end, branch_id, category_id });
    const conditions = [...filters];
    let idx = nextIdx;
    if (product_id) { conditions.push(`si.product_id = $${idx++}`); params.push(product_id); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    ({ rows } = await SQLquery(`
      SELECT date_trunc('${dateTrunc}', s.date)::date AS period,
        SUM(si.amount) AS sales_amount,
        SUM(si.quantity_display) AS units_sold
      FROM Sales_Items si
      JOIN Sales_Information s USING(sales_information_id)
      JOIN Inventory_Product ip ON si.product_id = ip.product_id AND s.branch_id = ip.branch_id
      ${where}
      GROUP BY 1
      ORDER BY 1;`, params));
  } else {
    const baseConditions = ['s.date BETWEEN $1 AND $2', RESTORED_SALES_FILTER];
    const params = [start, end];
    let idx = 3;
    if (branch_id) { baseConditions.push(`s.branch_id = $${idx++}`); params.push(branch_id); }
    const whereClause = 'WHERE ' + baseConditions.join(' AND ');
    const salesField = useNetAmount ? 's.amount_net_vat' : 's.total_amount_due';

    ({ rows } = await SQLquery(`
      WITH base_sales AS (
        SELECT s.sales_information_id,
               date_trunc('${dateTrunc}', s.date)::date AS period,
               ${salesField} AS sales_amount
        FROM Sales_Information s
        ${whereClause}
      ),
      units AS (
        SELECT si.sales_information_id,
               SUM(si.quantity_display) AS units_sold
        FROM Sales_Items si
        WHERE si.sales_information_id = ANY (SELECT sales_information_id FROM base_sales)
        GROUP BY si.sales_information_id
      )
      SELECT b.period,
             SUM(b.sales_amount) AS sales_amount,
             SUM(COALESCE(u.units_sold, 0)) AS units_sold
      FROM base_sales b
      LEFT JOIN units u USING (sales_information_id)
      GROUP BY b.period
      ORDER BY b.period;`, params));
  }

  const rawHistory = rows.map(row => ({
    period: dayjs(row.period).format('YYYY-MM-DD'),
    sales_amount: Number(row.sales_amount || 0),
    units_sold: Number(row.units_sold || 0)
  }));

  const resampledHistory = resampleTimeSeries(rawHistory, interval, start, end, ['sales_amount', 'units_sold']);

  const history = resampledHistory.map(item => ({
    period: item.period,
    sales_amount: Number(item.sales_amount || 0),
    units_sold: Number(item.units_sold || 0)
  }));

  let forecastResult = { forecast: [], insight: null };
  try {
    const forecastInput = history.map(item => ({
      period: item.period,
      value: item.units_sold
    }));
    forecastResult = await runDemandForecast({ history: forecastInput, interval });
  } catch (err) {
    console.error('Sales forecast error', err);
    forecastResult = { forecast: [], insight: null };
  }

  const forecastSeries = forecastResult.forecast.map(point => ({
    period: point.period,
    units_sold: Number(point.forecast || 0),
    forecast_lower: point.forecast_lower != null ? Number(point.forecast_lower) : null,
    forecast_upper: point.forecast_upper != null ? Number(point.forecast_upper) : null,
    is_forecast: true
  }));

  const combinedSeries = [
    ...history.map(item => ({ ...item, is_forecast: false })),
    ...forecastSeries
  ];

  const result = {
    history,
    forecast: forecastSeries,
    series: combinedSeries,
    forecast_context: forecastResult.insight
  };
  setAnalyticsCache(cacheKey, result);
  return result;
}





export async function fetchRestockTrends({ branch_id, interval, range }) {
  const { start, end } = buildDateRange(range);
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : interval === 'yearly' ? 'year' : 'month';
  const branchFilter = branch_id ? 'AND ip.branch_id = $3' : '';
  const params = [start, end];
  if(branch_id) params.push(branch_id);

  const cacheKey = makeAnalyticsCacheKey('fetchRestockTrends', { branch_id, interval, start, end });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { rows } = await SQLquery(`
    SELECT date_trunc('${dateTrunc}', a.date_added)::date AS period,
      SUM(a.quantity_added_display) AS total_added
    FROM Add_Stocks a
    JOIN Inventory_Product ip ON a.product_id = ip.product_id AND a.branch_id = ip.branch_id
    WHERE a.date_added BETWEEN $1 AND $2 ${branchFilter}
    GROUP BY 1
    ORDER BY 1;`, params);
  
  // FORMAT DATES USING DAYJS TO AVOID TIMEZONE ISSUES
  const result = rows.map(row => ({
    ...row,
    period: dayjs(row.period).format('YYYY-MM-DD')
  }));
  setAnalyticsCache(cacheKey, result);
  return result;
}





export async function fetchTopProducts({ branch_id, category_id, product_id, limit, range, start_date, end_date, interval = 'monthly', include_forecast = false }) {
  // Use custom dates if provided, otherwise use range
  let start, end;
  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }
  const historyStart = include_forecast ? computeHistoryStart(start, end, interval) : start;
  const cacheKey = makeAnalyticsCacheKey('fetchTopProducts', {
    branch_id,
    category_id,
    product_id,
    limit,
    interval,
    include_forecast,
    start,
    end
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { filters: summaryFilters, params: summaryParams } = buildSalesFilters({ start, end, branch_id, category_id, product_id });
  const where = 'WHERE ' + summaryFilters.join(' AND ');
  const safeLimit = Number.isFinite(Number.parseInt(limit, 10)) ? Number.parseInt(limit, 10) : 10;
  const { rows } = await SQLquery(`
    SELECT
      si.product_id,
      ip.product_name,
      SUM(si.amount) AS sales_amount,
      SUM(si.quantity_display) AS units_sold,
      MAX(ip.quantity) AS current_quantity,
      MAX(ip.min_threshold) AS min_threshold,
      MAX(ip.max_threshold) AS max_threshold
    FROM Sales_Items si
    JOIN Sales_Information s USING(sales_information_id)
    JOIN Inventory_Product ip ON si.product_id = ip.product_id AND s.branch_id = ip.branch_id
    ${where}
    GROUP BY 1,2
    ORDER BY sales_amount DESC
    LIMIT ${safeLimit};`, summaryParams);
  if (!include_forecast || rows.length === 0) {
    setAnalyticsCache(cacheKey, rows);
    return rows;
  }

  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : interval === 'yearly' ? 'year' : 'month';
  const MAX_FORECAST_PRODUCTS = 10;
  const topProductIds = rows.slice(0, MAX_FORECAST_PRODUCTS).map((product) => product.product_id);
  if (topProductIds.length === 0) {
    setAnalyticsCache(cacheKey, rows);
    return rows;
  }

  const historyFiltersContext = buildSalesFilters({ start: historyStart, end, branch_id, category_id, product_id });
  const productArrayParamIndex = historyFiltersContext.nextIdx;
  const historyFilters = [...historyFiltersContext.filters, `si.product_id = ANY($${productArrayParamIndex}::int[])`];
  const historyParams = [...historyFiltersContext.params, topProductIds];
  const historyWhere = 'WHERE ' + historyFilters.join(' AND ');

  const { rows: historyRows } = await SQLquery(`
      SELECT si.product_id,
             date_trunc('${dateTrunc}', s.date)::date AS period,
             SUM(si.quantity_display) AS units_sold,
             SUM(si.amount) AS sales_amount
      FROM Sales_Items si
      JOIN Sales_Information s USING(sales_information_id)
      JOIN Inventory_Product ip ON si.product_id = ip.product_id AND s.branch_id = ip.branch_id
      ${historyWhere}
      GROUP BY si.product_id, date_trunc('${dateTrunc}', s.date)
      ORDER BY si.product_id, date_trunc('${dateTrunc}', s.date);`, historyParams);

  const historyMap = new Map();
  for (const row of historyRows) {
    if (!historyMap.has(row.product_id)) {
      historyMap.set(row.product_id, []);
    }
    historyMap.get(row.product_id).push({
      period: dayjs(row.period).format('YYYY-MM-DD'),
      product_id: row.product_id,
      units_sold: Number(row.units_sold || 0),
      sales_amount: Number(row.sales_amount || 0)
    });
  }

  const lookbackConfig = HISTORY_LOOKBACK_CONFIG[interval] || HISTORY_LOOKBACK_CONFIG.default;

  const enriched = await Promise.all(rows.map(async (product, index) => {
    const rawHistory = historyMap.get(product.product_id) || [];
    const resampledHistory = resampleTimeSeries(rawHistory, interval, historyStart, end, ['units_sold', 'sales_amount'], {
      maxPoints: lookbackConfig?.maxPoints,
      staticFields: { product_id: product.product_id }
    });

    const historySeriesSource = resampledHistory.length ? resampledHistory : rawHistory;
    const historySeries = historySeriesSource.map(item => ({
      period: dayjs(item.period).format('YYYY-MM-DD'),
      units_sold: Number(item.units_sold || 0),
      sales_amount: Number(item.sales_amount || 0)
    }));

    const historyRangeStart = historySeries.length ? historySeries[0].period : (historyStart || null);
    const historyRangeEnd = historySeries.length ? historySeries[historySeries.length - 1].period : (end || null);
    const historyCoverageDays = historyRangeStart && historyRangeEnd && dayjs(historyRangeStart).isValid() && dayjs(historyRangeEnd).isValid()
      ? dayjs(historyRangeEnd).diff(dayjs(historyRangeStart), 'day') + 1
      : 0;
    const historyCoveragePeriods = historySeries.length;

    const hasSufficientHistory = rawHistory.length >= 2;

    if (index >= MAX_FORECAST_PRODUCTS || !hasSufficientHistory) {
      return {
        ...product,
        history: historySeries,
        forecast: [],
        forecast_context: null,
        history_range_start: historyRangeStart,
        history_range_end: historyRangeEnd,
        history_coverage_days: historyCoverageDays,
        history_coverage_periods: historyCoveragePeriods
      };
    }

    try {
      const forecastInput = historySeries.map(item => ({ period: item.period, value: item.units_sold }));
      const { forecast: forecastPoints, insight: forecastInsight } = await runDemandForecast({ history: forecastInput, interval });
      const forecastSeries = forecastPoints.map(point => ({
        period: point.period,
        forecast_units: Number(point.forecast || 0),
        forecast_lower: point.forecast_lower != null ? Number(point.forecast_lower) : null,
        forecast_upper: point.forecast_upper != null ? Number(point.forecast_upper) : null
      }));

      return {
        ...product,
        history: historySeries,
        forecast: forecastSeries,
        forecast_context: forecastInsight,
        history_range_start: historyRangeStart,
        history_range_end: historyRangeEnd,
        history_coverage_days: historyCoverageDays,
        history_coverage_periods: historyCoveragePeriods
      };
    } catch (err) {
      console.error('Top product forecast error', err);
      return {
        ...product,
        history: historySeries,
        forecast: [],
        forecast_context: null,
        history_range_start: historyRangeStart,
        history_range_end: historyRangeEnd,
        history_coverage_days: historyCoverageDays,
        history_coverage_periods: historyCoveragePeriods
      };
    }
  }));

  setAnalyticsCache(cacheKey, enriched);
  return enriched;
}





export async function fetchCategoryDistribution({ branch_id }) {
  const branchFilter = branch_id ? 'WHERE ip.branch_id = $1' : '';
  const params = branch_id ? [branch_id] : [];

  const cacheKey = makeAnalyticsCacheKey('fetchCategoryDistribution', { branch_id });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { rows } = await SQLquery(`
    SELECT c.category_name, SUM(ip.quantity * ip.unit_price) AS inventory_value
    FROM Inventory_Product ip
    JOIN Category c USING(category_id)
    ${branchFilter}
    GROUP BY 1
    ORDER BY inventory_value DESC;`, params);
  setAnalyticsCache(cacheKey, rows);
  return rows;
}





export async function fetchKPIs({ branch_id, category_id, product_id, range, start_date, end_date, use_net_amount }) {

  let start, end;
  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }

  const cacheKey = makeAnalyticsCacheKey('fetchKPIs', {
    branch_id,
    category_id,
    product_id,
    range,
    start,
    end,
    use_net_amount: Boolean(use_net_amount) && !(category_id || product_id)
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }


  // CALCULATING DATE DIFFERENCE USING DAY.JS
  const startDate = dayjs(start);
  const endDate = dayjs(end);
  const daysDifference = endDate.diff(startDate, 'day') + 1; 


  // SETTING PREVIOUS DATE
  const prevEndDate = startDate.subtract(1, 'day');
  const prevStartDate = prevEndDate.subtract(daysDifference - 1, 'day');
  
  // PREVIOUS DATES (LASTT MONTH, WEEK, YEAR, DAY)
  const prevStart = prevStartDate.format('YYYY-MM-DD');
  const prevEnd = prevEndDate.format('YYYY-MM-DD');  
  
  // Helper function to add delivery filter conditions
  const addDeliveryFilter = (conditions) => {
    conditions.push(RESTORED_SALES_FILTER);
  };
  
  const hasCategoryFilter = Boolean(category_id);
  const hasProductFilter = Boolean(product_id);
  const shouldUseSalesItems = hasCategoryFilter || hasProductFilter;
  const useNetAmount = Boolean(use_net_amount) && !shouldUseSalesItems;

  if (hasCategoryFilter) {
    // CURRENT SALES
    const conditions = ['s.date BETWEEN $1 AND $2', 'ip.category_id = $3'];
    addDeliveryFilter(conditions);
    const params = [start, end, category_id];
    let salesIdx = 4;
    if (branch_id) { conditions.push(`s.branch_id = $${salesIdx++}`); params.push(branch_id); }
    if (product_id) { conditions.push(`si.product_id = $${salesIdx++}`); params.push(product_id); }
    const where = 'WHERE ' + conditions.join(' AND ');
    const { rows: salesRows } = await SQLquery(`
      SELECT COALESCE(SUM(si.amount),0) AS total_sales
      FROM Sales_Items si
      JOIN Sales_Information s USING(sales_information_id)
      JOIN Inventory_Product ip ON si.product_id = ip.product_id AND s.branch_id = ip.branch_id
      ${where};`, params);



    //PREVIOUS SALES
    const prevConditions = ['s.date BETWEEN $1 AND $2', 'ip.category_id = $3'];
    addDeliveryFilter(prevConditions);
    const prevParams = [prevStart, prevEnd, category_id];
    let prevSalesIdx = 4;
    if (branch_id) { prevConditions.push(`s.branch_id = $${prevSalesIdx++}`); prevParams.push(branch_id); }
    if (product_id) { prevConditions.push(`si.product_id = $${prevSalesIdx++}`); prevParams.push(product_id); }
    const prevWhere = 'WHERE ' + prevConditions.join(' AND ');
    const { rows: prevSalesRows } = await SQLquery(`
      SELECT COALESCE(SUM(si.amount),0) AS total_sales
      FROM Sales_Items si
      JOIN Sales_Information s USING(sales_information_id)
      JOIN Inventory_Product ip ON si.product_id = ip.product_id AND s.branch_id = ip.branch_id
      ${prevWhere};`, prevParams);



    //CURRENT INVESTMENTS
    const investConditions = ['a.date_added BETWEEN $1 AND $2', 'ip.category_id = $3'];
    const investParams = [start, end, category_id];
    let investIdx = 4;
    if (branch_id) { investConditions.push(`ip.branch_id = $${investIdx++}`); investParams.push(branch_id); }
    if (product_id) { investConditions.push(`ip.product_id = $${investIdx++}`); investParams.push(product_id); }
    const investWhere = 'WHERE ' + investConditions.join(' AND ');
    const { rows: investRows } = await SQLquery(`
      SELECT COALESCE(SUM(a.quantity_added_display * ip.unit_cost), 0) AS total_investment
      FROM Add_Stocks a
      JOIN Inventory_Product ip ON a.product_id = ip.product_id AND a.branch_id = ip.branch_id
      ${investWhere};`, investParams);



    // PREVIOUS INVESTMENTS
    const prevInvestConditions = ['a.date_added BETWEEN $1 AND $2', 'ip.category_id = $3'];
    const prevInvestParams = [prevStart, prevEnd, category_id];
    let prevInvestIdx = 4;
    if (branch_id) { prevInvestConditions.push(`ip.branch_id = $${prevInvestIdx++}`); prevInvestParams.push(branch_id); }
    if (product_id) { prevInvestConditions.push(`ip.product_id = $${prevInvestIdx++}`); prevInvestParams.push(product_id); }
    const prevInvestWhere = 'WHERE ' + prevInvestConditions.join(' AND ');
    const { rows: prevInvestRows } = await SQLquery(`
      SELECT COALESCE(SUM(a.quantity_added_display * ip.unit_cost), 0) AS total_investment
      FROM Add_Stocks a
      JOIN Inventory_Product ip ON a.product_id = ip.product_id AND a.branch_id = ip.branch_id
      ${prevInvestWhere};`, prevInvestParams);

    // INVENTORY COUNT (FILTERED BY CATEGORY AND OPTIONAL BRANCH)
    const invCntConds = ['ip.category_id = $1'];
    const invCntParams = [category_id];
    let invCountIdx = 2;                                                  
    if (branch_id) { invCntConds.push(`ip.branch_id = $${invCountIdx++}`); invCntParams.push(branch_id); }
    if (product_id) { invCntConds.push(`ip.product_id = $${invCountIdx++}`); invCntParams.push(product_id); }
    const invCntWhere = 'WHERE ' + invCntConds.join(' AND ');
    const { rows: invCountRows } = await SQLquery(`
      SELECT COUNT(DISTINCT ip.product_id) AS inventory_count
      FROM Inventory_Product ip
      ${invCntWhere};`, invCntParams);

    const total_sales = Number(salesRows[0].total_sales || 0);
    const total_investment = Number(investRows[0].total_investment || 0);
    const total_profit = total_sales - total_investment;

    
    const prev_total_sales = Number(prevSalesRows[0].total_sales || 0);
    const prev_total_investment = Number(prevInvestRows[0].total_investment || 0);
    const prev_total_profit = prev_total_sales - prev_total_investment;



    const inventory_count = Number(invCountRows?.[0]?.inventory_count || 0);

    return { total_sales, total_investment, total_profit, prev_total_sales, prev_total_investment, prev_total_profit, inventory_count, range: { start, end }};

  }

  // CURRENT SALE (NO CATEGORY FILTER)
  let salesRows;
  let prevSalesRows;

  if (shouldUseSalesItems) {
    const salesConditions = ['s.date BETWEEN $1 AND $2'];
    addDeliveryFilter(salesConditions);
    const salesParams = [start, end];
    let salesIdx = 3;
    if (branch_id) { salesConditions.push(`s.branch_id = $${salesIdx++}`); salesParams.push(branch_id); }
    if (product_id) { salesConditions.push(`si.product_id = $${salesIdx++}`); salesParams.push(product_id); }
    const salesWhere = 'WHERE ' + salesConditions.join(' AND ');
    ({ rows: salesRows } = await SQLquery(`
      SELECT COALESCE(SUM(si.amount),0) AS total_sales
      FROM Sales_Information s
      JOIN Sales_Items si USING(sales_information_id)
      ${salesWhere};`,
      salesParams));

    const prevSalesConditions = ['s.date BETWEEN $1 AND $2'];
    addDeliveryFilter(prevSalesConditions);
    const prevSalesParams = [prevStart, prevEnd];
    let prevSalesIdx = 3;
    if (branch_id) { prevSalesConditions.push(`s.branch_id = $${prevSalesIdx++}`); prevSalesParams.push(branch_id); }
    if (product_id) { prevSalesConditions.push(`si.product_id = $${prevSalesIdx++}`); prevSalesParams.push(product_id); }
    const prevSalesWhere = 'WHERE ' + prevSalesConditions.join(' AND ');
    ({ rows: prevSalesRows } = await SQLquery(`
      SELECT COALESCE(SUM(si.amount),0) AS total_sales
      FROM Sales_Information s
      JOIN Sales_Items si USING(sales_information_id)
      ${prevSalesWhere};`, 
      prevSalesParams));
  } else {
    const salesConditions = ['s.date BETWEEN $1 AND $2'];
    addDeliveryFilter(salesConditions);
    const salesParams = [start, end];
    let salesIdx = 3;
    if (branch_id) { salesConditions.push(`s.branch_id = $${salesIdx++}`); salesParams.push(branch_id); }
    const salesWhere = 'WHERE ' + salesConditions.join(' AND ');
    const salesField = useNetAmount ? 's.amount_net_vat' : 's.total_amount_due';
    ({ rows: salesRows } = await SQLquery(`
      SELECT COALESCE(SUM(${salesField}),0) AS total_sales
      FROM Sales_Information s
      ${salesWhere};`,
      salesParams));

    const prevSalesConditions = ['s.date BETWEEN $1 AND $2'];
    addDeliveryFilter(prevSalesConditions);
    const prevSalesParams = [prevStart, prevEnd];
    let prevSalesIdx = 3;
    if (branch_id) { prevSalesConditions.push(`s.branch_id = $${prevSalesIdx++}`); prevSalesParams.push(branch_id); }
    const prevSalesWhere = 'WHERE ' + prevSalesConditions.join(' AND ');
    ({ rows: prevSalesRows } = await SQLquery(`
      SELECT COALESCE(SUM(${salesField}),0) AS total_sales
      FROM Sales_Information s
      ${prevSalesWhere};`, 
      prevSalesParams));
  }

  // CURRENT INVESTMENT
  const investConditions = ['a.date_added BETWEEN $1 AND $2'];
  const investParams = [start, end];
  let investIdx = 3;
  if (branch_id) { investConditions.push(`ip.branch_id = $${investIdx++}`); investParams.push(branch_id); }
  if (product_id) { investConditions.push(`ip.product_id = $${investIdx++}`); investParams.push(product_id); }
  const investWhere = 'WHERE ' + investConditions.join(' AND ');
  const { rows: investRows } = await SQLquery(`
    SELECT COALESCE(SUM(a.quantity_added_display * ip.unit_cost), 0) AS total_investment
    FROM Add_Stocks a
    JOIN Inventory_Product ip ON a.product_id = ip.product_id AND a.branch_id = ip.branch_id
    ${investWhere};`,
     investParams);

  // PREVIOUS INVESTMENT
  const prevInvestConditions = ['a.date_added BETWEEN $1 AND $2'];
  const prevInvestParams = [prevStart, prevEnd];
  let prevInvestIdx = 3;
  if (branch_id) { prevInvestConditions.push(`ip.branch_id = $${prevInvestIdx++}`); prevInvestParams.push(branch_id); }
  if (product_id) { prevInvestConditions.push(`ip.product_id = $${prevInvestIdx++}`); prevInvestParams.push(product_id); }
  const prevInvestWhere = 'WHERE ' + prevInvestConditions.join(' AND ');
  const { rows: prevInvestRows } = await SQLquery(`
    SELECT COALESCE(SUM(a.quantity_added_display * ip.unit_cost), 0) AS total_investment
    FROM Add_Stocks a
    JOIN Inventory_Product ip ON a.product_id = ip.product_id AND a.branch_id = ip.branch_id
    ${prevInvestWhere};`,
     prevInvestParams);


  // INVENTORY COUNT (NO CATEGORY FILTER, OPTIONAL BRANCH)
  const invCountConditions = [];
  const invCountParams = [];
  let invCountIdx = 1;
  if (branch_id) { invCountConditions.push(`ip.branch_id = $${invCountIdx++}`); invCountParams.push(branch_id); }
  if (product_id) { invCountConditions.push(`ip.product_id = $${invCountIdx++}`); invCountParams.push(product_id); }
  const invCountWhere = invCountConditions.length ? 'WHERE ' + invCountConditions.join(' AND ') : '';
  const { rows: invCountRows } = await SQLquery(`
    SELECT COUNT(DISTINCT ip.product_id) AS inventory_count
    FROM Inventory_Product ip
    ${invCountWhere};`, invCountParams);

  const total_sales = Number(salesRows[0].total_sales || 0);
  const total_investment = Number(investRows[0].total_investment || 0);
  const total_profit = (total_sales - total_investment) < 0 ? 0 : total_sales - total_investment ;


  const prev_total_sales = Number(prevSalesRows[0].total_sales || 0);
  const prev_total_investment = Number(prevInvestRows[0].total_investment || 0);
  const prev_total_profit = (prev_total_sales - prev_total_investment) < 0 ? 0 : prev_total_sales - prev_total_investment;


  const inventory_count = Number(invCountRows?.[0]?.inventory_count || 0);

  const result = { total_sales, total_investment, total_profit, prev_total_sales, prev_total_investment, prev_total_profit, inventory_count, range: { start, end }};
  setAnalyticsCache(cacheKey, result);
  return result;

}





export async function fetchBranches(){
  const { rows } = await SQLquery('SELECT branch_id, branch_name, address FROM branch ORDER BY branch_name ASC');
  return rows;
}




export async function fetchBranchTimeline({ branch_id, category_id, interval, start_date, end_date, range, use_net_amount }) {
  // Use custom dates if provided, otherwise use range
  let start, end;
  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }

  const cacheKey = makeAnalyticsCacheKey('fetchBranchTimeline', {
    branch_id,
    category_id,
    interval,
    start,
    end,
    use_net_amount: Boolean(use_net_amount) && !category_id
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Determine date truncation based on interval
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : interval === 'yearly' ? 'year' : 'month';
  
  // Build conditions and parameters - optimized for performance
  const hasCategoryFilter = Boolean(category_id);
  const useNetAmount = Boolean(use_net_amount) && !hasCategoryFilter;
  const conditions = ['s.date BETWEEN $1 AND $2', 's.branch_id = $3', RESTORED_SALES_FILTER];
  const params = [start, end, branch_id];
  let idx = 4;
  
  if (hasCategoryFilter) { 
    conditions.push(`ip.category_id = $${idx++}`); 
    params.push(category_id); 
  }
  
  const where = 'WHERE ' + conditions.join(' AND ');
  
  // Different date formatting based on interval for better display
  let dateSelect;
  if (interval === 'daily') {
    dateSelect = `date_trunc('${dateTrunc}', s.date)::date AS period,
                  TO_CHAR(date_trunc('${dateTrunc}', s.date), 'Mon DD') AS formatted_period`;
  } else if (interval === 'weekly') {
    dateSelect = `date_trunc('${dateTrunc}', s.date)::date AS period,
                  TO_CHAR(date_trunc('${dateTrunc}', s.date), 'Mon DD') AS formatted_period`;
  } else {
    dateSelect = `date_trunc('${dateTrunc}', s.date)::date AS period,
                  TO_CHAR(date_trunc('${dateTrunc}', s.date), 'Mon YYYY') AS formatted_period`;
  }
  
  let rows;
  
  if (hasCategoryFilter) {
    const query = `
      SELECT ${dateSelect},
        SUM(si.amount) AS sales_amount,
        SUM(si.quantity_display) AS units_sold,
        COUNT(DISTINCT s.sales_information_id) AS transaction_count
      FROM Sales_Information s
      JOIN Sales_Items si USING(sales_information_id)
      JOIN Inventory_Product ip ON si.product_id = ip.product_id AND s.branch_id = ip.branch_id
      ${where}
      GROUP BY date_trunc('${dateTrunc}', s.date)
      ORDER BY period;`;
    ({ rows } = await SQLquery(query, params));
  } else {
    const baseWhere = 'WHERE ' + ['s.date BETWEEN $1 AND $2', 's.branch_id = $3', RESTORED_SALES_FILTER].join(' AND ');
    const salesField = useNetAmount ? 's.amount_net_vat' : 's.total_amount_due';
    const query = `
      WITH base_sales AS (
        SELECT s.sales_information_id,
               date_trunc('${dateTrunc}', s.date)::date AS period,
               ${salesField} AS sales_amount
        FROM Sales_Information s
        ${baseWhere}
      ),
      units AS (
        SELECT si.sales_information_id,
               SUM(si.quantity_display) AS units_sold
        FROM Sales_Items si
        WHERE si.sales_information_id = ANY (SELECT sales_information_id FROM base_sales)
        GROUP BY si.sales_information_id
      )
      SELECT b.period,
             ${interval === 'daily' || interval === 'weekly' ? "TO_CHAR(b.period, 'Mon DD')" : "TO_CHAR(b.period, 'Mon YYYY')"} AS formatted_period,
             SUM(b.sales_amount) AS sales_amount,
             SUM(COALESCE(u.units_sold, 0)) AS units_sold,
             COUNT(DISTINCT b.sales_information_id) AS transaction_count
      FROM base_sales b
      LEFT JOIN units u USING (sales_information_id)
      GROUP BY b.period
      ORDER BY b.period;`;
    ({ rows } = await SQLquery(query, params));
  }
    
  // FORMAT DATES USING DAYJS TO AVOID TIMEZONE ISSUES
  const result = rows.map(row => ({
    ...row,
    period: dayjs(row.period).format('YYYY-MM-DD'),
    sales_amount: Number(row.sales_amount || 0),
    units_sold: Number(row.units_sold || 0),
    transaction_count: Number(row.transaction_count || 0)
  }));
  setAnalyticsCache(cacheKey, result);
  return result;
}





export async function fetchBranchSalesSummary({ start_date, end_date, range, category_id, product_id, use_net_amount }) {
  // USE CUSTOM DATES IF PROVIDED; OTHERWISE FALL BACK TO RANGE
  let start;
  let end;
  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }

  const normalizeNumeric = (value) => {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizedCategoryId = normalizeNumeric(category_id);
  const normalizedProductId = normalizeNumeric(product_id);
  const hasCategoryFilter = normalizedCategoryId !== null;
  const hasProductFilter = normalizedProductId !== null;

  const useNetAmount = Boolean(use_net_amount) && !hasCategoryFilter && !hasProductFilter;

  const cacheKey = makeAnalyticsCacheKey('fetchBranchSalesSummary', {
    start,
    end,
    category_id: hasCategoryFilter ? normalizedCategoryId : null,
    product_id: hasProductFilter ? normalizedProductId : null,
    use_net_amount: useNetAmount
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  const params = [start, end];
  let nextParamIndex = 3;

  let salesItemsJoin = '';
  let sumExpression = useNetAmount
    ? 'COALESCE(SUM(s.amount_net_vat), 0)'
    : 'COALESCE(SUM(s.total_amount_due), 0)';

  if (hasProductFilter || hasCategoryFilter) {
    const joinConditions = ['si.sales_information_id = s.sales_information_id'];

    if (hasProductFilter) {
      const productIdx = nextParamIndex;
      params.push(normalizedProductId);
      joinConditions.push(`si.product_id = $${productIdx}`);
      nextParamIndex += 1;
    }

    if (hasCategoryFilter) {
      const categoryIdx = nextParamIndex;
      params.push(normalizedCategoryId);
      joinConditions.push(`EXISTS (
        SELECT 1 FROM Inventory_Product ip
        WHERE ip.product_id = si.product_id
          AND ip.branch_id = s.branch_id
          AND ip.category_id = $${categoryIdx}
      )`);
      nextParamIndex += 1;
    }

    salesItemsJoin = `
      LEFT JOIN Sales_Items si ON ${joinConditions.join(' AND ')}
    `;
    sumExpression = 'COALESCE(SUM(si.amount), 0)';
  }

  const query = `
    SELECT b.branch_id,
           b.branch_name,
           ${sumExpression} AS total_amount_due
    FROM branch b
    LEFT JOIN Sales_Information s ON s.branch_id = b.branch_id
      AND s.date BETWEEN $1 AND $2
      AND ${RESTORED_SALES_FILTER}
    ${salesItemsJoin}
    GROUP BY b.branch_id, b.branch_name
    ORDER BY total_amount_due DESC, b.branch_name ASC;`;

  const { rows } = await SQLquery(query, params);

  const result = rows.map(row => ({
    ...row,
    total_amount_due: Number(row.total_amount_due || 0)
  }));
  setAnalyticsCache(cacheKey, result);
  return result;
}
