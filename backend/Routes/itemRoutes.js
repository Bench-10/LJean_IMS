import express from 'express';
import * as itemControllers from '../Controllers/itemControllers.js';
import { writeOperationLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();


//INVENTORY CRUD
router.get("/items", itemControllers.getAllItems);
router.post("/items", writeOperationLimiter, itemControllers.addItem);
router.put("/items/:id", writeOperationLimiter, itemControllers.updateItem);
router.get("/items/search", itemControllers.searchItem);
router.get("/items/unique", itemControllers.getAllUniqueProducts);
router.get("/items/pending", itemControllers.getPendingInventoryRequests);
router.patch("/items/pending/:id/approve", writeOperationLimiter, itemControllers.approvePendingInventoryRequest);
router.patch("/items/pending/:id/reject", writeOperationLimiter, itemControllers.rejectPendingInventoryRequest);



//CATEGORY ROUTES
router.get("/categories", itemControllers.getAllCategories);
router.post("/categories", writeOperationLimiter, itemControllers.addCAtegory);
router.put("/categories/:id", writeOperationLimiter, itemControllers.updateCategory);



//PRODUCT HISTORY
router.post("/product_history", itemControllers.getAllProductHistory);



//GET FOR PRODUCT VALIDITY
router.get("/product_validity", itemControllers.getAllProductValidity);



//SHOW NOTIFICATIONSs
router.get("/notifications", itemControllers.getNotification);
router.post("/notifications", itemControllers.markRead);
router.post("/notifications/mark-all-read", itemControllers.markAllRead);



export default router;




