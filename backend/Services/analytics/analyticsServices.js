import { SQLquery } from '../../db.js';
import { correctDateFormat } from '../Services_Utils/convertRedableDate.js';
import dayjs from 'dayjs';
import { runDemandForecast } from '../forecasting/forecastService.js';


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
 
  const branchFilter = branch_id ? 'AND ip.branch_id = $3' : '';
  const params = [start, end];
  if(branch_id) params.push(branch_id);
  const { rows } = await SQLquery(`
    WITH adds AS (
      SELECT a.product_id, a.date_added::date AS d, SUM(a.quantity_added) qty_added
      FROM Add_Stocks a
      WHERE a.date_added BETWEEN $1 AND $2
      GROUP BY 1,2
    ), sales AS (
      SELECT si.product_id, s.date::date AS d, SUM(si.quantity) qty_sold
      FROM Sales_Items si
      JOIN Sales_Information s USING(sales_information_id)
      WHERE s.date BETWEEN $1 AND $2
      GROUP BY 1,2
    ), calendar AS (
      SELECT generate_series($1::date, $2::date, interval '1 day')::date AS d
    ), products AS (
      SELECT ip.product_id, ip.product_name, ip.branch_id FROM Inventory_Product ip WHERE 1=1 ${branchFilter}
    ), daily AS (
      SELECT c.d, p.product_id, p.product_name, COALESCE(a.qty_added,0) qty_added, COALESCE(s.qty_sold,0) qty_sold
      FROM calendar c CROSS JOIN products p
      LEFT JOIN adds a ON a.product_id = p.product_id AND a.d = c.d
      LEFT JOIN sales s ON s.product_id = p.product_id AND s.d = c.d
    ), cumulative AS (
      SELECT d, product_id, product_name,
        SUM(qty_added - qty_sold) OVER (PARTITION BY product_id ORDER BY d ROWS UNBOUNDED PRECEDING) AS stock_level
      FROM daily
    )
    SELECT d as date, product_id, product_name, stock_level
    FROM cumulative
    ORDER BY product_id, d;`, params);
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
  const conditions = ['s.date BETWEEN $1 AND $2'];
  const params = [start, end];
  let idx = 3;
  if (branch_id) { conditions.push(`s.branch_id = $${idx++}`); params.push(branch_id); }
  if (category_id) { conditions.push(`ip.category_id = $${idx++}`); params.push(category_id); }
  if (product_id) { conditions.push(`si.product_id = $${idx++}`); params.push(product_id); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await SQLquery(`
    SELECT date_trunc('${dateTrunc}', s.date)::date AS period,
      SUM(si.amount) AS sales_amount,
      SUM(si.quantity) AS units_sold
    FROM Sales_Items si
    JOIN Sales_Information s USING(sales_information_id)
    JOIN Inventory_Product ip USING(product_id)
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

  return {
    history,
    forecast: forecastSeries,
    series: combinedSeries
  };
}





export async function fetchRestockTrends({ branch_id, interval, range }) {
  const { start, end } = buildDateRange(range);
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : 'month';
  const branchFilter = branch_id ? 'AND ip.branch_id = $3' : '';
  const params = [start, end];
  if(branch_id) params.push(branch_id);
  const { rows } = await SQLquery(`
    SELECT date_trunc('${dateTrunc}', a.date_added)::date AS period,
      SUM(a.quantity_added) AS total_added
    FROM Add_Stocks a
    JOIN Inventory_Product ip USING(product_id)
    WHERE a.date_added BETWEEN $1 AND $2 ${branchFilter}
    GROUP BY 1
    ORDER BY 1;`, params);
  
  // FORMAT DATES USING DAYJS TO AVOID TIMEZONE ISSUES
  return rows.map(row => ({
    ...row,
    period: dayjs(row.period).format('YYYY-MM-DD')
  }));
}





export async function fetchTopProducts({ branch_id, category_id, limit, range, start_date, end_date }) {
  // Use custom dates if provided, otherwise use range
  let start, end;
  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    ({ start, end } = buildDateRange(range));
  }
  const conditions = ['s.date BETWEEN $1 AND $2'];
  const params = [start, end];
  let idx = 3;
  if (branch_id) { conditions.push(`s.branch_id = $${idx++}`); params.push(branch_id); }
  if (category_id) { conditions.push(`ip.category_id = $${idx++}`); params.push(category_id); }
  const where = 'WHERE ' + conditions.join(' AND ');
  const { rows } = await SQLquery(`
    SELECT si.product_id, ip.product_name, SUM(si.amount) AS sales_amount, SUM(si.quantity) AS units_sold
    FROM Sales_Items si
    JOIN Sales_Information s USING(sales_information_id)
    JOIN Inventory_Product ip USING(product_id)
    ${where}
    GROUP BY 1,2
    ORDER BY sales_amount DESC
    LIMIT ${parseInt(limit)};`, params);
  return rows;
}





export async function fetchCategoryDistribution({ branch_id }) {
  const branchFilter = branch_id ? 'WHERE ip.branch_id = $1' : '';
  const params = branch_id ? [branch_id] : [];
  const { rows } = await SQLquery(`
    SELECT c.category_name, SUM(ip.quantity * ip.unit_price) AS inventory_value
    FROM Inventory_Product ip
    JOIN Category c USING(category_id)
    ${branchFilter}
    GROUP BY 1
    ORDER BY inventory_value DESC;`, params);
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
  
  
  if (category_id) {
    // CURRENT SALES
    const conditions = ['s.date BETWEEN $1 AND $2', 'ip.category_id = $3'];
    const params = [start, end, category_id];
    let salesIdx = 4;
    if (branch_id) { conditions.push(`s.branch_id = $${salesIdx++}`); params.push(branch_id); }
    if (product_id) { conditions.push(`si.product_id = $${salesIdx++}`); params.push(product_id); }
    const where = 'WHERE ' + conditions.join(' AND ');
    const { rows: salesRows } = await SQLquery(`
      SELECT COALESCE(SUM(si.amount),0) AS total_sales
      FROM Sales_Items si
      JOIN Sales_Information s USING(sales_information_id)
      JOIN Inventory_Product ip USING(product_id)
      ${where};`, params);



    //PREVIOUS SALES
    const prevConditions = ['s.date BETWEEN $1 AND $2', 'ip.category_id = $3'];
    const prevParams = [prevStart, prevEnd, category_id];
    let prevSalesIdx = 4;
    if (branch_id) { prevConditions.push(`s.branch_id = $${prevSalesIdx++}`); prevParams.push(branch_id); }
    if (product_id) { prevConditions.push(`si.product_id = $${prevSalesIdx++}`); prevParams.push(product_id); }
    const prevWhere = 'WHERE ' + prevConditions.join(' AND ');
    const { rows: prevSalesRows } = await SQLquery(`
      SELECT COALESCE(SUM(si.amount),0) AS total_sales
      FROM Sales_Items si
      JOIN Sales_Information s USING(sales_information_id)
      JOIN Inventory_Product ip USING(product_id)
      ${prevWhere};`, prevParams);



    //CURRENT INVESTMENTS
    const investConditions = ['a.date_added BETWEEN $1 AND $2', 'ip.category_id = $3'];
    const investParams = [start, end, category_id];
    let investIdx = 4;
    if (branch_id) { investConditions.push(`ip.branch_id = $${investIdx++}`); investParams.push(branch_id); }
    if (product_id) { investConditions.push(`ip.product_id = $${investIdx++}`); investParams.push(product_id); }
    const investWhere = 'WHERE ' + investConditions.join(' AND ');
    const { rows: investRows } = await SQLquery(`
      SELECT COALESCE(SUM(a.quantity_added * ip.unit_cost), 0) AS total_investment
      FROM Add_Stocks a
      JOIN Inventory_Product ip USING(product_id)
      ${investWhere};`, investParams);



    // PREVIOUS INVESTMENTS
    const prevInvestConditions = ['a.date_added BETWEEN $1 AND $2', 'ip.category_id = $3'];
    const prevInvestParams = [prevStart, prevEnd, category_id];
    let prevInvestIdx = 4;
    if (branch_id) { prevInvestConditions.push(`ip.branch_id = $${prevInvestIdx++}`); prevInvestParams.push(branch_id); }
    if (product_id) { prevInvestConditions.push(`ip.product_id = $${prevInvestIdx++}`); prevInvestParams.push(product_id); }
    const prevInvestWhere = 'WHERE ' + prevInvestConditions.join(' AND ');
    const { rows: prevInvestRows } = await SQLquery(`
      SELECT COALESCE(SUM(a.quantity_added * ip.unit_cost), 0) AS total_investment
      FROM Add_Stocks a
      JOIN Inventory_Product ip USING(product_id)
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
    SELECT COALESCE(SUM(a.quantity_added * ip.unit_cost), 0) AS total_investment
    FROM Add_Stocks a
    JOIN Inventory_Product ip USING(product_id)
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
    SELECT COALESCE(SUM(a.quantity_added * ip.unit_cost), 0) AS total_investment
    FROM Add_Stocks a
    JOIN Inventory_Product ip USING(product_id)
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

  return { total_sales, total_investment, total_profit, prev_total_sales, prev_total_investment, prev_total_profit, inventory_count, range: { start, end }};

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

  // Determine date truncation based on interval
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : 'month';
  
  // Build conditions and parameters
  const conditions = ['s.date BETWEEN $1 AND $2', 's.branch_id = $3'];
  const params = [start, end, branch_id];
  let idx = 4;
  
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
      SUM(si.quantity) AS units_sold,
      COUNT(DISTINCT s.sales_information_id) AS transaction_count
    FROM Sales_Items si
    JOIN Sales_Information s USING(sales_information_id)
    JOIN Inventory_Product ip USING(product_id)
    ${where}
    GROUP BY date_trunc('${dateTrunc}', s.date)
    ORDER BY period;`, params);
    
  // FORMAT DATES USING DAYJS TO AVOID TIMEZONE ISSUES
  return rows.map(row => ({
    ...row,
    period: dayjs(row.period).format('YYYY-MM-DD')
  }));
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

  // BUILD CATEGORY FILTER IF PROVIDED
  let categoryJoin = '';
  let categoryFilter = '';
  const params = [start, end];
  
  if (category_id) {
    categoryJoin = `
      LEFT JOIN Sales_Items si ON si.sales_information_id = s.sales_information_id
      LEFT JOIN Inventory_Product ip ON ip.product_id = si.product_id
    `;
    categoryFilter = `AND (s.sales_information_id IS NULL OR ip.category_id = $3)`;
    params.push(category_id);
  }

  // RETURN TOTAL AMOUNT DUE PER BRANCH, INCLUDING BRANCHES WITH ZERO SALES
  // WITH OPTIONAL CATEGORY FILTERING
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
    ${categoryJoin}
    WHERE 1=1 ${categoryFilter}
    GROUP BY b.branch_id, b.branch_name
    ORDER BY total_amount_due DESC, b.branch_name ASC;`, params);

  return rows;
}
