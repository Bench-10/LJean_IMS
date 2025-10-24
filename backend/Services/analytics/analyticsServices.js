import { SQLquery } from '../../db.js';
import { correctDateFormat } from '../Services_Utils/convertRedableDate.js';
import dayjs from 'dayjs';
import { runDemandForecast } from '../forecasting/forecastService.js';


const RESTORED_SALES_FILTER = `NOT EXISTS (
    SELECT 1 FROM Sales_Stock_Usage ssu 
    WHERE ssu.sales_information_id = s.sales_information_id 
    AND ssu.is_restored = true
  )`;

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





export async function fetchSalesPerformance({ branch_id, category_id, product_id, interval, range, start_date, end_date }) {
  let start;
  let end;

  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : 'month';
  const cacheKey = makeAnalyticsCacheKey('fetchSalesPerformance', {
    branch_id,
    category_id,
    product_id,
    interval,
    start,
    end
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { filters, params, nextIdx } = buildSalesFilters({ start, end, branch_id, category_id });
  const conditions = [...filters];
  let idx = nextIdx;
  if (product_id) { conditions.push(`si.product_id = $${idx++}`); params.push(product_id); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await SQLquery(`
    SELECT date_trunc('${dateTrunc}', s.date)::date AS period,
      SUM(si.amount) AS sales_amount,
      SUM(si.quantity_display) AS units_sold
    FROM Sales_Items si
    JOIN Sales_Information s USING(sales_information_id)
    JOIN Inventory_Product ip ON si.product_id = ip.product_id AND s.branch_id = ip.branch_id
    ${where}
    GROUP BY 1
    ORDER BY 1;`, params);
  
  // FORMAT DATES USING DAYJS TO AVOID TIMEZONE ISSUES
  const history = rows.map(row => ({
    period: dayjs(row.period).format('YYYY-MM-DD'),
    sales_amount: Number(row.sales_amount || 0),
    units_sold: Number(row.units_sold || 0)
  }));

  let forecast = [];
  try {
    const forecastInput = history.map(item => ({
      period: item.period,
      value: item.units_sold
    }));
    forecast = await runDemandForecast({ history: forecastInput, interval });
  } catch (err) {
    console.error('Sales forecast error', err);
    forecast = [];
  }


  const forecastSeries = forecast.map(point => ({
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
    series: combinedSeries
  };
  setAnalyticsCache(cacheKey, result);
  return result;
}





export async function fetchRestockTrends({ branch_id, interval, range }) {
  const { start, end } = buildDateRange(range);
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : 'month';
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





export async function fetchTopProducts({ branch_id, category_id, limit, range, start_date, end_date, interval = 'monthly', include_forecast = false }) {
  // Use custom dates if provided, otherwise use range
  let start, end;
  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }
  const cacheKey = makeAnalyticsCacheKey('fetchTopProducts', {
    branch_id,
    category_id,
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

  const { filters, params, nextIdx } = buildSalesFilters({ start, end, branch_id, category_id });
  const where = 'WHERE ' + filters.join(' AND ');
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
    LIMIT ${safeLimit};`, params);
  if (!include_forecast || rows.length === 0) {
    setAnalyticsCache(cacheKey, rows);
    return rows;
  }

  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : 'month';
  const MAX_FORECAST_PRODUCTS = 10;
  const topProductIds = rows.slice(0, MAX_FORECAST_PRODUCTS).map((product) => product.product_id);
  if (topProductIds.length === 0) {
    setAnalyticsCache(cacheKey, rows);
    return rows;
  }

  const productArrayParamIndex = nextIdx;
  const historyFilters = [...filters, `si.product_id = ANY($${productArrayParamIndex}::int[])`];
  const historyParams = [...params, topProductIds];
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
      units_sold: Number(row.units_sold || 0),
      sales_amount: Number(row.sales_amount || 0)
    });
  }

  const enriched = await Promise.all(rows.map(async (product, index) => {
    const historySeries = historyMap.get(product.product_id) || [];
    if (index >= MAX_FORECAST_PRODUCTS || historySeries.length < 2) {
      return { ...product, history: historySeries, forecast: [] };
    }

    try {
      const forecastInput = historySeries.map(item => ({ period: item.period, value: item.units_sold }));
      const forecast = await runDemandForecast({ history: forecastInput, interval });
      const forecastSeries = forecast.map(point => ({
        period: point.period,
        forecast_units: Number(point.forecast || 0),
        forecast_lower: point.forecast_lower != null ? Number(point.forecast_lower) : null,
        forecast_upper: point.forecast_upper != null ? Number(point.forecast_upper) : null
      }));

      return {
        ...product,
        history: historySeries,
        forecast: forecastSeries
      };
    } catch (err) {
      console.error('Top product forecast error', err);
      return {
        ...product,
        history: historySeries,
        forecast: []
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





export async function fetchKPIs({ branch_id, category_id, product_id, range, start_date, end_date }) {

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
    end
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
  
  if (category_id) {
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
  const salesConditions = ['s.date BETWEEN $1 AND $2'];
  addDeliveryFilter(salesConditions);
  const salesParams = [start, end];
  let salesIdx = 3;
  if (branch_id) { salesConditions.push(`s.branch_id = $${salesIdx++}`); salesParams.push(branch_id); }
  if (product_id) { salesConditions.push(`si.product_id = $${salesIdx++}`); salesParams.push(product_id); }
  const salesWhere = 'WHERE ' + salesConditions.join(' AND ');
  const salesJoin = product_id ? 'JOIN Sales_Items si USING(sales_information_id)' : '';
  const { rows: salesRows } = await SQLquery(`
    SELECT COALESCE(SUM(${product_id ? 'si.amount' : 'total_amount_due'}),0) AS total_sales
    FROM Sales_Information s
    ${salesJoin}
    ${salesWhere};`,
    salesParams);

  // PREVIOUS SALE (NO CATEGORY FILTER)
  const prevSalesConditions = ['s.date BETWEEN $1 AND $2'];
  addDeliveryFilter(prevSalesConditions);
  const prevSalesParams = [prevStart, prevEnd];
  let prevSalesIdx = 3;
  if (branch_id) { prevSalesConditions.push(`s.branch_id = $${prevSalesIdx++}`); prevSalesParams.push(branch_id); }
  if (product_id) { prevSalesConditions.push(`si.product_id = $${prevSalesIdx++}`); prevSalesParams.push(product_id); }
  const prevSalesWhere = 'WHERE ' + prevSalesConditions.join(' AND ');
  const prevSalesJoin = product_id ? 'JOIN Sales_Items si USING(sales_information_id)' : '';
  const { rows: prevSalesRows } = await SQLquery(`
    SELECT COALESCE(SUM(${product_id ? 'si.amount' : 'total_amount_due'}),0) AS total_sales
    FROM Sales_Information s
    ${prevSalesJoin}
    ${prevSalesWhere};`, 
    prevSalesParams);

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
  const { rows } = await SQLquery('SELECT branch_id, branch_name, address FROM Branch ORDER BY branch_name ASC');
  return rows;
}




export async function fetchBranchTimeline({ branch_id, category_id, interval, start_date, end_date, range }) {
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
    end
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Determine date truncation based on interval
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : 'month';
  
  // Build conditions and parameters
  const conditions = ['s.date BETWEEN $1 AND $2', 's.branch_id = $3'];
  const params = [start, end, branch_id];
  let idx = 4;
  
  // Include all sales except those where stock has been restored (canceled/undelivered)
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM Sales_Stock_Usage ssu 
    WHERE ssu.sales_information_id = s.sales_information_id 
    AND ssu.is_restored = true
  )`);
  
  if (category_id) { 
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
  
  const { rows } = await SQLquery(`
    SELECT ${dateSelect},
      SUM(si.amount) AS sales_amount,
      SUM(si.quantity_display) AS units_sold,
      COUNT(DISTINCT s.sales_information_id) AS transaction_count
    FROM Sales_Items si
    JOIN Sales_Information s USING(sales_information_id)
    JOIN Inventory_Product ip ON si.product_id = ip.product_id AND s.branch_id = ip.branch_id
    ${where}
    GROUP BY date_trunc('${dateTrunc}', s.date)
    ORDER BY period;`, params);
    
  // FORMAT DATES USING DAYJS TO AVOID TIMEZONE ISSUES
  const result = rows.map(row => ({
    ...row,
    period: dayjs(row.period).format('YYYY-MM-DD')
  }));
  setAnalyticsCache(cacheKey, result);
  return result;
}





export async function fetchBranchSalesSummary({ start_date, end_date, range, category_id }){
  // USE CUSTOM DATES IF PROVIDED; OTHERWISE FALL BACK TO RANGE
  let start, end;
  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }

  const cacheKey = makeAnalyticsCacheKey('fetchBranchSalesSummary', {
    start,
    end,
    category_id
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  // BUILD CATEGORY FILTER IF PROVIDED
  let categoryJoin = '';
  let categoryFilter = '';
  const params = [start, end];
  
  if (category_id) {
    categoryJoin = `
      LEFT JOIN Sales_Items si ON si.sales_information_id = s.sales_information_id
      LEFT JOIN Inventory_Product ip ON ip.product_id = si.product_id AND ip.branch_id = s.branch_id
    `;
    categoryFilter = `AND (s.sales_information_id IS NULL OR ip.category_id = $3)`;
    params.push(category_id);
  }
  
  // Only include sales except those where stock has been restored (canceled/undelivered)
  const deliveryFilter = `AND NOT EXISTS (
    SELECT 1 FROM Sales_Stock_Usage ssu 
    WHERE ssu.sales_information_id = s.sales_information_id 
    AND ssu.is_restored = true
  )`;

  // RETURN TOTAL AMOUNT DUE PER BRANCH, INCLUDING BRANCHES WITH ZERO SALES
  // WITH OPTIONAL CATEGORY FILTERING AND DELIVERY STATUS FILTERING
  const { rows } = await SQLquery(`
    SELECT b.branch_id,
           b.branch_name,
           ${category_id 
             ? 'COALESCE(SUM(DISTINCT CASE WHEN ip.category_id = $3 THEN si.amount ELSE 0 END), 0) AS total_amount_due'
             : 'COALESCE(SUM(s.total_amount_due), 0) AS total_amount_due'
           }
    FROM Branch b
    LEFT JOIN Sales_Information s
      ON s.branch_id = b.branch_id
     AND s.date BETWEEN $1 AND $2
     ${deliveryFilter}
    ${categoryJoin}
    WHERE 1=1 ${categoryFilter}
    GROUP BY b.branch_id, b.branch_name
    ORDER BY total_amount_due DESC, b.branch_name ASC;`, params);

  setAnalyticsCache(cacheKey, rows);
  return rows;
}
