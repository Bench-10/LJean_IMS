import express from 'express';
import * as analyticsControllers from '../Controllers/analyticsControllers.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

//INVENTORY LEVELS
router.get('/analytics/inventory-levels', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getInventoryLevels);



//SALES(NOT YET POLISHED)
router.get('/analytics/sales-performance', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getSalesPerformance);



//FOR RESTOCK
router.get('/analytics/restock-trends', authenticate, requireRole('Owner', 'Branch Manager', 'Inventory Staff'), analyticsControllers.getRestockTrends);



//TOP PRODUCTS BY SALES AMOUNT
router.get('/analytics/top-products', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getTopProducts);



//BY CATEGORY
router.get('/analytics/category-distribution', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getCategoryDistribution);



//KPI
router.get('/analytics/kpis', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getKPIs);



//BRANCH LIST FOR OWNERS VIEWING
router.get('/analytics/branches', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getBranches);

//BRANCH SALES SUMMARY (TOTAL AMOUNT DUE PER BRANCH)
router.get('/analytics/branches-summary', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getBranchSalesSummary);

//BRANCH TIMELINE - DEDICATED ENDPOINT FOR BRANCH-SPECIFIC TIMELINE DATA
router.get('/analytics/branch-timeline', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getBranchTimeline);

//DELIVERY INFORMATION
router.get('/analytics/delivery', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.numberOfDeliveriesByDate);


export default router;
