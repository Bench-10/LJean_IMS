import * as analyticsServices from '../Services/analytics/analyticsServices.js';
import * as deliveryAnalyticsServices from '../Services/analytics/deliveryAnalyticsServices.js';




export const getInventoryLevels = async (req, res) => {
  try {


    const { branch_id, range = '1y' } = req.query;
    const rows = await analyticsServices.fetchInventoryLevels({ branch_id, range });
    res.json(rows);
    
  } catch (err) {

    console.error('Inventory levels error', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};





export const getSalesPerformance = async (req, res) => {
  try {
    const {
      branch_id,
      category_id,
      product_id,
      interval = 'monthly',
      range = '1y',
      start_date,
      end_date
    } = req.query;
    const rows = await analyticsServices.fetchSalesPerformance({
      branch_id,
      category_id,
      product_id,
      interval,
      range,
      start_date,
      end_date
    });
    res.json(rows);
  } catch (err) {


    console.error('Sales performance error', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};





export const getRestockTrends = async (req, res) => {
  try {

    const { branch_id, interval = 'monthly', range = '1y' } = req.query;
    const rows = await analyticsServices.fetchRestockTrends({ branch_id, interval, range });
    res.json(rows);
  } catch (err) {

    console.error('Restock trends error', err);
    res.status(500).json({ message: 'Internal Server Error' });

  }

};





export const getTopProducts = async (req, res) => {

  try {

    const { branch_id, category_id, limit = 10, range = '3m', start_date, end_date } = req.query;
    const rows = await analyticsServices.fetchTopProducts({ branch_id, category_id, limit, range, start_date, end_date });
    res.json(rows);

  } catch (err) {

    console.error('Top products error', err);
    res.status(500).json({ message: 'Internal Server Error' });

  }

};





export const getCategoryDistribution = async (req, res) => {
  try {

    const { branch_id } = req.query;
    const rows = await analyticsServices.fetchCategoryDistribution({ branch_id });
    res.json(rows);

  } catch (err) {
    console.error('Category distribution error', err);
    res.status(500).json({ message: 'Internal Server Error' });

  }

};





export const getKPIs = async (req, res) => {
  try {
  const { branch_id, category_id, product_id, range = '1m', start_date, end_date } = req.query;
  const rows = await analyticsServices.fetchKPIs({ branch_id, category_id, product_id, range, start_date, end_date });
    res.json(rows);

  } catch (err) {
    console.error('KPI error', err);
    res.status(500).json({ message: 'Internal Server Error' });

  }

};





export const getBranches = async (_req, res) => {
  try {

    const rows = await analyticsServices.fetchBranches();
    res.json(rows);

  } catch (err) {
    console.error('Branches error', err);
    res.status(500).json({ message: 'Internal Server Error' });

  }

};




//FOR FETCHING DELIVERY BY DATE
export const numberOfDeliveriesByDate = async (req, res) => {
  try {

    const { branch_id, format = 'monthly', start_date, end_date, status = 'delivered' } = req.query;
    
    console.log('Delivery request params:', { branch_id, format, start_date, end_date, status });
    
    const rows = await deliveryAnalyticsServices.numberOfDelivery(format, branch_id, start_date, end_date, status);
    
    console.log('Delivery response data:', rows);
    
    res.json(rows);

  } catch (err) {
    console.error('Delivery analytics error', err);
    res.status(500).json({ message: 'Internal Server Error' });

  }

};



// BRANCH TIMELINE - DEDICATED ENDPOINT FOR BRANCH-SPECIFIC TIMELINE DATA
export const getBranchTimeline = async (req, res) => {
  try {
    const { branch_id, category_id, interval = 'monthly', start_date, end_date, range = '3m' } = req.query;
    
    // Validate required branch_id
    if (!branch_id) {
      return res.status(400).json({ message: 'branch_id is required' });
    }
    
    console.log('Branch timeline request params:', { branch_id, category_id, interval, start_date, end_date, range });
    
    const rows = await analyticsServices.fetchBranchTimeline({ 
      branch_id, 
      category_id, 
      interval, 
      start_date, 
      end_date, 
      range 
    });
    
    console.log('Branch timeline response data:', rows);
    
    res.json(rows);
  } catch (err) {
    console.error('Branch timeline error', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



// BRANCH SALES SUMMARY (TOTAL AMOUNT DUE PER BRANCH)
export const getBranchSalesSummary = async (req, res) => {
  try {
    const { start_date, end_date, range = '3m', category_id } = req.query;
    const rows = await analyticsServices.fetchBranchSalesSummary({ start_date, end_date, range, category_id });
    res.json(rows);
  } catch (err) {
    console.error('Branch sales summary error', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};