import express from 'express';
import * as itemControllers from '../Controllers/itemControllers.js';
import { writeOperationLimiter } from '../middleware/rateLimiters.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();


//INVENTORY CRUD
router.get("/items", authenticate, itemControllers.getAllItems);
router.post("/items", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), writeOperationLimiter, itemControllers.addItem);
router.put("/items/:id", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), writeOperationLimiter, itemControllers.updateItem);
router.get("/items/search", authenticate, itemControllers.searchItem);
router.get("/items/unique", authenticate, itemControllers.getAllUniqueProducts);
router.get("/items/request-status", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), itemControllers.getInventoryRequestStatusFeed);
router.get("/items/pending", authenticate, requireRole('Branch Manager', 'Owner'), itemControllers.getPendingInventoryRequests);
router.patch("/items/pending/:id/approve", authenticate, requireRole('Branch Manager', 'Owner'), writeOperationLimiter, itemControllers.approvePendingInventoryRequest);
router.patch("/items/pending/:id/reject", authenticate, requireRole('Branch Manager', 'Owner'), writeOperationLimiter, itemControllers.rejectPendingInventoryRequest);



//CATEGORY ROUTES
router.get("/categories", authenticate, itemControllers.getAllCategories);
router.post("/categories", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), writeOperationLimiter, itemControllers.addCAtegory);
router.put("/categories/:id", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), writeOperationLimiter, itemControllers.updateCategory);



//PRODUCT HISTORY
router.post("/product_history", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), itemControllers.getAllProductHistory);



//GET FOR PRODUCT VALIDITY
router.get("/product_validity", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), itemControllers.getAllProductValidity);



//SHOW NOTIFICATIONSs
router.get("/notifications", authenticate, itemControllers.getNotification);
router.post("/notifications", authenticate, itemControllers.markRead);
router.post("/notifications/mark-all-read", authenticate, itemControllers.markAllRead);



export default router;




