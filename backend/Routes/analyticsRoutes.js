import express from 'express';
import * as analyticsControllers from '../Controllers/analyticsControllers.js';

const router = express.Router();

//INVENTORY LEVELS
router.get('/analytics/inventory-levels', analyticsControllers.getInventoryLevels);



//SALES(NOT YET POLISHED)
router.get('/analytics/sales-performance', analyticsControllers.getSalesPerformance);



//FOR RESTOCK
router.get('/analytics/restock-trends', analyticsControllers.getRestockTrends);



//TOP PRODUCTS BY SALES AMOUNT
router.get('/analytics/top-products', analyticsControllers.getTopProducts);



//BY CATEGORY
router.get('/analytics/category-distribution', analyticsControllers.getCategoryDistribution);



//KPI
router.get('/analytics/kpis', analyticsControllers.getKPIs);



//BRANCH LIST FOR OWNERS VIEWING
router.get('/analytics/branches', analyticsControllers.getBranches);



//DELIVERY INFORMATION
router.get('/analytics/delivery', analyticsControllers.numberOfDeliveriesByDate);


export default router;
