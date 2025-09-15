import { SQLquery } from '../../db.js';
import { correctDateFormat } from '../Services_Utils/convertRedableDate.js';
import dayjs from 'dayjs';


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





export async function fetchSalesPerformance({ branch_id, category_id, interval, range }) {
  const { start, end } = buildDateRange(range);
  const dateTrunc = interval === 'weekly' ? 'week' : interval === 'daily' ? 'day' : 'month';
  const conditions = ['s.date BETWEEN $1 AND $2'];
  const params = [start, end];
  let idx = 3;
  if (branch_id) { conditions.push(`s.branch_id = $${idx++}`); params.push(branch_id); }
  if (category_id) { conditions.push(`ip.category_id = $${idx++}`); params.push(category_id); }
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
  return rows;
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
  return rows;
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





export async function fetchKPIs({ branch_id, category_id, range, start_date, end_date }) {

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
    if (branch_id) { conditions.push('s.branch_id = $4'); params.push(branch_id); }
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
    if (branch_id) { prevConditions.push('s.branch_id = $4'); prevParams.push(branch_id); }
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
    if (branch_id) { investConditions.push('ip.branch_id = $4'); investParams.push(branch_id); }
    const investWhere = 'WHERE ' + investConditions.join(' AND ');
    const { rows: investRows } = await SQLquery(`
      SELECT COALESCE(SUM(a.quantity_added * ip.unit_cost), 0) AS total_investment
      FROM Add_Stocks a
      JOIN Inventory_Product ip USING(product_id)
      ${investWhere};`, investParams);



    // PRIVIOUS INVESTMENTS
    const prevInvestConditions = ['a.date_added BETWEEN $1 AND $2', 'ip.category_id = $3'];
    const prevInvestParams = [prevStart, prevEnd, category_id];
    if (branch_id) { prevInvestConditions.push('ip.branch_id = $4'); prevInvestParams.push(branch_id); }
    const prevInvestWhere = 'WHERE ' + prevInvestConditions.join(' AND ');
    const { rows: prevInvestRows } = await SQLquery(`
      SELECT COALESCE(SUM(a.quantity_added * ip.unit_cost), 0) AS total_investment
      FROM Add_Stocks a
      JOIN Inventory_Product ip USING(product_id)
      ${prevInvestWhere};`, prevInvestParams);

    const total_sales = Number(salesRows[0].total_sales || 0);
    const total_investment = Number(investRows[0].total_investment || 0);
    const total_profit = total_sales - total_investment;

    
    const prev_total_sales = Number(prevSalesRows[0].total_sales || 0);
    const prev_total_investment = Number(prevInvestRows[0].total_investment || 0);
    const prev_total_profit = prev_total_sales - prev_total_investment;



    return { total_sales, total_investment, total_profit, prev_total_sales, prev_total_investment, prev_total_profit,  range: { start, end }};

  }

  // CURRENT SALE (NO CATEGORY FILTER)
  const salesParams = branch_id ? [start, end, branch_id] : [start, end];
  const salesBranchFilter = branch_id ? 'AND s.branch_id = $3' : '';
  const { rows: salesRows } = await SQLquery(`
    SELECT COALESCE(SUM(total_amount_due),0) AS total_sales
    FROM Sales_Information s
    WHERE s.date BETWEEN $1 AND $2 ${salesBranchFilter};`,
    salesParams);

  // PREVIOUS SALE (NO CATEGORY FILTER)
  const prevSalesParams = branch_id ? [prevStart, prevEnd, branch_id] : [prevStart, prevEnd];
  const { rows: prevSalesRows } = await SQLquery(`
    SELECT COALESCE(SUM(total_amount_due),0) AS total_sales
    FROM Sales_Information s
    WHERE s.date BETWEEN $1 AND $2 ${salesBranchFilter};`, 
    prevSalesParams);

  // CURRENT INVESTMENT
  const investParams = branch_id ? [start, end, branch_id] : [start, end];
  const investBranchFilter = branch_id ? 'AND ip.branch_id = $3' : '';
  const { rows: investRows } = await SQLquery(`
    SELECT COALESCE(SUM(a.quantity_added * ip.unit_cost), 0) AS total_investment
    FROM Add_Stocks a
    JOIN Inventory_Product ip USING(product_id)
    WHERE a.date_added BETWEEN $1 AND $2 ${investBranchFilter};`,
     investParams);

  // PREVIOUS INVENTMENT
  const prevInvestParams = branch_id ? [prevStart, prevEnd, branch_id] : [prevStart, prevEnd];
  const { rows: prevInvestRows } = await SQLquery(`
    SELECT COALESCE(SUM(a.quantity_added * ip.unit_cost), 0) AS total_investment
    FROM Add_Stocks a
    JOIN Inventory_Product ip USING(product_id)
    WHERE a.date_added BETWEEN $1 AND $2 ${investBranchFilter};`,
     prevInvestParams);


  const total_sales = Number(salesRows[0].total_sales || 0);
  const total_investment = Number(investRows[0].total_investment || 0);
  const total_profit = total_sales - total_investment;


  const prev_total_sales = Number(prevSalesRows[0].total_sales || 0);
  const prev_total_investment = Number(prevInvestRows[0].total_investment || 0);
  const prev_total_profit = prev_total_sales - prev_total_investment;


  return { total_sales, total_investment, total_profit, prev_total_sales, prev_total_investment, prev_total_profit,  range: { start, end }};

}





export async function fetchBranches(){
  const { rows } = await SQLquery('SELECT branch_id, branch_name, address FROM Branch ORDER BY branch_name ASC');
  return rows;
}
