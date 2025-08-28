import * as analyticsServices from '../Services/analytics/analyticsServices.js';





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
     
    const { branch_id, category_id, interval = 'monthly', range = '1y' } = req.query;
    const rows = await analyticsServices.fetchSalesPerformance({ branch_id, category_id, interval, range });
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

    const { branch_id, category_id, limit = 10, range = '3m' } = req.query;
    const rows = await analyticsServices.fetchTopProducts({ branch_id, category_id, limit, range });
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
  const { branch_id, category_id, range = '1m' } = req.query;
  const rows = await analyticsServices.fetchKPIs({ branch_id, category_id, range });
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
