import express from 'express';
import * as analyticsControllers from '../Controllers/analyticsControllers.js';

const router = express.Router();

// Inventory levels over time (stock history)
router.get('/analytics/inventory-levels', analyticsControllers.getInventoryLevels);



// Sales performance (time series)
router.get('/analytics/sales-performance', analyticsControllers.getSalesPerformance);



// Restock trends (aggregate add_stocks)
router.get('/analytics/restock-trends', analyticsControllers.getRestockTrends);



// Top products by sales amount
router.get('/analytics/top-products', analyticsControllers.getTopProducts);



// Category distribution of inventory value
router.get('/analytics/category-distribution', analyticsControllers.getCategoryDistribution);



// KPI metrics (total sales, investment, profit placeholder)
router.get('/analytics/kpis', analyticsControllers.getKPIs);



// Branch list (for owner view)
router.get('/analytics/branches', analyticsControllers.getBranches);

export default router;
